import { randomUUID } from "node:crypto";
import {
  checkNeo4j,
  getDatabaseName,
  getDriver,
  readQuery,
  writeQuery,
  writeTransaction,
} from "./neo4j";

export const queries = {
  dashboardMetrics: `
    MATCH (c:Customer)
    WITH count(c) AS customers
    OPTIONAL MATCH (o:Order)
    WITH customers, count(o) AS orders
    OPTIONAL MATCH (s:Shipment)
    WITH customers, orders, count(s) AS shipments,
      count(CASE WHEN s.status = 'DELIVERED' THEN 1 END) AS delivered,
      count(CASE WHEN s.status IN ['FAILED', 'DELIVERY_FAILED'] THEN 1 END) AS failed,
      count(CASE WHEN s.return_status = 'RETURNED' THEN 1 END) AS returned
    OPTIONAL MATCH (s2:Shipment)-[:HAS_ATTEMPT]->(a:DeliveryAttempt)
    WITH customers, orders, shipments, delivered, failed, returned,
      coalesce(avg(toFloat(a.attempt_number)), 0) AS averageAttempts
    OPTIONAL MATCH (p:Prediction)
    RETURN customers, orders, shipments, delivered, failed, returned,
      averageAttempts, count(CASE WHEN p.risk_level = 'HIGH' THEN 1 END) AS highRisk
  `,
  statusDistribution: `
    MATCH (s:Shipment)
    RETURN s.status AS name, count(s) AS value
    ORDER BY value DESC
  `,
  failureReasons: `
    MATCH (a:DeliveryAttempt)-[:FAILED_DUE_TO]->(r:FailureReason)
    RETURN r.reason_name AS name, count(a) AS value
    ORDER BY value DESC
  `,
  zonePerformance: `
    MATCH (s:Shipment)-[:BELONGS_TO_ZONE]->(z:Zone)
    WITH z.name AS name, count(s) AS total,
      count(CASE WHEN s.status IN ['FAILED', 'DELIVERY_FAILED'] THEN 1 END) AS failed
    RETURN name, total, failed,
      CASE WHEN total = 0 THEN 0.0 ELSE toFloat(failed) / total END AS failureRate
    ORDER BY failureRate DESC
  `,
  agentPerformance: `
    MATCH (s:Shipment)-[:ASSIGNED_TO]->(a:DeliveryAgent)
    WITH a.name AS name, count(s) AS shipments,
      count(CASE WHEN s.status = 'DELIVERED' THEN 1 END) AS delivered
    RETURN name, shipments, delivered,
      CASE WHEN shipments = 0 THEN 0.0 ELSE toFloat(delivered) / shipments END AS successRate
    ORDER BY successRate DESC
    LIMIT 8
  `,
};

export async function dashboardSummary() {
  const [metrics, statusDistribution, failureReasons, zonePerformance, agentPerformance, highRiskShipments, recentActivity] =
    await Promise.all([
      readQuery(queries.dashboardMetrics),
      readQuery(queries.statusDistribution),
      readQuery(queries.failureReasons),
      readQuery(queries.zonePerformance),
      readQuery(queries.agentPerformance),
      highRisk(),
      activity(),
    ]);
  const first = metrics[0] ?? {};
  const shipments = Number(first.shipments ?? 0);
  const failed = Number(first.failed ?? 0);
  return {
    metrics: {
      customers: Number(first.customers ?? 0),
      orders: Number(first.orders ?? 0),
      shipments,
      delivered: Number(first.delivered ?? 0),
      failed,
      returned: Number(first.returned ?? 0),
      failureRate: shipments ? failed / shipments : 0,
      averageAttempts: Number(first.averageAttempts ?? 0),
      highRisk: Number(first.highRisk ?? 0),
    },
    statusDistribution,
    failureReasons,
    zonePerformance,
    agentPerformance,
    highRiskShipments,
    recentActivity,
  };
}

export async function highRisk() {
  return readQuery(`
    MATCH (s:Shipment)-[:HAS_PREDICTION]->(p:Prediction)
    OPTIONAL MATCH (s)<-[:HAS_SHIPMENT]-(o:Order)<-[:PLACED]-(c:Customer)
    OPTIONAL MATCH (s)-[:BELONGS_TO_ZONE]->(z:Zone)
    OPTIONAL MATCH (s)-[:HAS_ATTEMPT]->(attempt:DeliveryAttempt)
    WITH s, p, c, z, count(attempt) AS attemptCount
    WHERE p.risk_level = 'HIGH'
    RETURN s.shipment_id AS shipmentId, coalesce(c.name, 'Unknown') AS customerName,
      coalesce(z.name, 'Unassigned') AS zone, p.failure_probability AS failureProbability,
      p.risk_level AS riskLevel, s.status AS status, attemptCount,
      CASE WHEN attemptCount > 1 THEN 'Escalate to operations' ELSE 'Review address and time window' END AS attention
    ORDER BY failureProbability DESC
  `);
}

export async function activity() {
  return readQuery(`
    MATCH (a:AuditLog)
    RETURN a.audit_id AS id, a.timestamp AS timestamp, a.user AS user,
      a.operation AS operation, a.entity AS entity, a.action AS action,
      a.success AS success, a.query AS query
    ORDER BY a.timestamp DESC
    LIMIT 12
  `);
}

export async function logActivity(input: {
  user: string;
  operation: string;
  entity: string;
  action: string;
  success: boolean;
  query?: string;
}) {
  const auditId = `AUD-${randomUUID().slice(0, 8).toUpperCase()}`;
  await writeQuery(
    `CREATE (a:AuditLog {
      audit_id: $auditId, timestamp: datetime(), user: $user,
      operation: $operation, entity: $entity, action: $action,
      success: $success, query: $query
    })`,
    { auditId, ...input },
  );
}

export async function createCustomer(input: {
  name: string;
  email: string;
  phone: string;
}) {
  const customerId = `CUS-${randomUUID().slice(0, 8).toUpperCase()}`;
  const rows = await writeQuery(
    `CREATE (c:Customer {
      customer_id: $customerId, name: $name, email: $email, phone: $phone,
      status: 'ACTIVE', created_at: datetime()
    })
    RETURN c.customer_id AS customerId, c.name AS name, c.email AS email,
      c.phone AS phone, c.status AS status, toString(c.created_at) AS createdAt,
      0 AS orderCount, 0 AS shipmentCount`,
    { customerId, ...input },
  );
  return rows[0];
}

export async function listCustomers(search?: string) {
  return readQuery(
    `MATCH (c:Customer)
     OPTIONAL MATCH (c)-[:PLACED]->(o:Order)
     OPTIONAL MATCH (o)-[:HAS_SHIPMENT]->(s:Shipment)
     WITH c, count(DISTINCT o) AS orderCount, count(DISTINCT s) AS shipmentCount
     WHERE $search = '' OR toLower(c.customer_id) CONTAINS toLower($search)
       OR toLower(c.name) CONTAINS toLower($search)
       OR toLower(c.email) CONTAINS toLower($search)
     RETURN c.customer_id AS customerId, c.name AS name, c.email AS email,
       c.phone AS phone, c.status AS status, toString(c.created_at) AS createdAt,
       orderCount, shipmentCount
     ORDER BY c.created_at DESC
     LIMIT 100`,
    { search: search ?? "" },
  );
}

export async function getCustomer(customerId: string) {
  const rows = await readQuery(
    `MATCH (c:Customer {customer_id: $customerId})
     OPTIONAL MATCH (c)-[:HAS_ADDRESS]->(address:Address)
     OPTIONAL MATCH (c)-[:PLACED]->(o:Order)-[:HAS_SHIPMENT]->(s:Shipment)
     RETURN c.customer_id AS customerId, c.name AS name, c.email AS email,
       c.phone AS phone, c.status AS status, toString(c.created_at) AS createdAt,
       count(DISTINCT o) AS orderCount, count(DISTINCT s) AS shipmentCount,
       collect(DISTINCT address {.*}) AS addresses,
       collect(DISTINCT o {orderId: o.order_id, customerId: c.customer_id,
         amount: o.amount, paymentType: o.payment_type, priority: o.priority,
         status: o.status, orderDate: toString(o.order_date),
         itemCount: 0, shipmentId: s.shipment_id}) AS orders,
       collect(DISTINCT s {shipmentId: s.shipment_id, orderId: o.order_id,
         customerId: c.customer_id, customerName: c.name, status: s.status,
         distanceKm: s.distance_km, attemptCount: 0, failureProbability: null,
         riskLevel: null}) AS shipments`,
    { customerId },
  );
  return rows[0];
}

export async function updateCustomer(
  customerId: string,
  input: { name?: string; email?: string; phone?: string; status?: string },
) {
  const rows = await writeQuery(
    `MATCH (c:Customer {customer_id: $customerId})
     SET c.name = coalesce($name, c.name), c.email = coalesce($email, c.email),
       c.phone = coalesce($phone, c.phone), c.status = coalesce($status, c.status)
     RETURN c.customer_id AS customerId, c.name AS name, c.email AS email,
       c.phone AS phone, c.status AS status, toString(c.created_at) AS createdAt,
       0 AS orderCount, 0 AS shipmentCount`,
    { customerId, ...input },
  );
  return rows[0];
}

export async function deactivateCustomer(customerId: string) {
  await writeQuery(
    `MATCH (c:Customer {customer_id: $customerId}) SET c.status = 'INACTIVE'`,
    { customerId },
  );
}

export async function listOrders(search?: string) {
  return readQuery(
    `MATCH (o:Order)<-[:PLACED]-(c:Customer)
     OPTIONAL MATCH (o)-[:HAS_SHIPMENT]->(s:Shipment)
     WHERE $search = '' OR toLower(o.order_id) CONTAINS toLower($search)
       OR toLower(c.name) CONTAINS toLower($search)
     RETURN o.order_id AS orderId, c.customer_id AS customerId, o.amount AS amount,
       o.payment_type AS paymentType, o.priority AS priority, o.status AS status,
       toString(o.order_date) AS orderDate, 0 AS itemCount, s.shipment_id AS shipmentId
     ORDER BY o.order_date DESC LIMIT 100`,
    { search: search ?? "" },
  );
}

export async function createOrder(input: {
  customerId: string;
  amount: number;
  paymentType: string;
  priority: string;
  productName?: string;
  quantity?: number;
}) {
  const orderId = `ORD-${randomUUID().slice(0, 8).toUpperCase()}`;
  const itemId = `ITEM-${randomUUID().slice(0, 8).toUpperCase()}`;
  const rows = await writeQuery(
    `MATCH (c:Customer {customer_id: $customerId})
     CREATE (o:Order {
       order_id: $orderId, order_date: date(), amount: $amount,
       payment_type: $paymentType, priority: $priority, status: 'CREATED'
     })
     CREATE (c)-[:PLACED]->(o)
     CREATE (item:OrderItem {
       item_id: $itemId, product_name: $productName, quantity: $quantity, price: $amount
     })
     CREATE (o)-[:CONTAINS]->(item)
     RETURN o.order_id AS orderId, c.customer_id AS customerId, o.amount AS amount,
       o.payment_type AS paymentType, o.priority AS priority, o.status AS status,
       toString(o.order_date) AS orderDate, 1 AS itemCount, null AS shipmentId`,
    { orderId, itemId, productName: input.productName ?? "Delivery item", quantity: input.quantity ?? 1, ...input },
  );
  return rows[0];
}

export async function listShipments(search?: string, status?: string) {
  return readQuery(
    `MATCH (s:Shipment)
     OPTIONAL MATCH (o:Order)-[:HAS_SHIPMENT]->(s)
     OPTIONAL MATCH (c:Customer)-[:PLACED]->(o)
     OPTIONAL MATCH (s)-[:BELONGS_TO_ZONE]->(z:Zone)
     OPTIONAL MATCH (s)-[:ASSIGNED_TO]->(a:DeliveryAgent)
     OPTIONAL MATCH (s)-[:ROUTED_THROUGH]->(h:Hub)
     OPTIONAL MATCH (s)-[:HAS_ATTEMPT]->(attempt:DeliveryAttempt)
     OPTIONAL MATCH (s)-[:HAS_PREDICTION]->(p:Prediction)
     WITH s, o, c, z, a, h, p, count(attempt) AS attemptCount
     WHERE ($search = '' OR toLower(s.shipment_id) CONTAINS toLower($search)
       OR toLower(c.name) CONTAINS toLower($search))
       AND ($status = '' OR s.status = $status)
     RETURN s.shipment_id AS shipmentId, o.order_id AS orderId, c.customer_id AS customerId,
       coalesce(c.name, 'Unknown') AS customerName, coalesce(z.name, 'Unassigned') AS zone,
       coalesce(a.name, 'Unassigned') AS agent, coalesce(h.name, 'Unassigned') AS hub,
       s.vehicle_id AS vehicle, s.status AS status, toString(s.shipment_date) AS shipmentDate,
       toString(s.expected_delivery_date) AS expectedDeliveryDate, s.distance_km AS distanceKm,
       attemptCount, p.failure_probability AS failureProbability, p.risk_level AS riskLevel
     ORDER BY s.shipment_date DESC LIMIT 100`,
    { search: search ?? "", status: status ?? "" },
  );
}

export async function createShipment(input: {
  orderId: string;
  customerId: string;
  addressId: string;
  agentId: string;
  hubId: string;
  zoneId: string;
  vehicleId?: string | null;
  shipmentDate: string;
  expectedDeliveryDate: string;
  distanceKm: number;
  deliveryTimeWindow?: string;
}) {
  const shipmentId = `SHP-${randomUUID().slice(0, 8).toUpperCase()}`;
  const rows = await writeQuery(
    `MATCH (c:Customer {customer_id: $customerId}), (o:Order {order_id: $orderId}),
      (address:Address {address_id: $addressId}), (agent:DeliveryAgent {agent_id: $agentId}),
      (hub:Hub {hub_id: $hubId}), (zone:Zone {zone_id: $zoneId})
     CREATE (s:Shipment {
       shipment_id: $shipmentId, shipment_date: date($shipmentDate),
       expected_delivery_date: date($expectedDeliveryDate), status: 'PENDING',
       distance_km: $distanceKm, delivery_time_window: $deliveryTimeWindow,
       vehicle_id: $vehicleId, return_status: 'NOT_RETURNED'
     })
     CREATE (o)-[:HAS_SHIPMENT]->(s)
     CREATE (s)-[:DELIVER_TO]->(address)
     CREATE (s)-[:ASSIGNED_TO]->(agent)
     CREATE (s)-[:ROUTED_THROUGH]->(hub)
     CREATE (s)-[:BELONGS_TO_ZONE]->(zone)
     RETURN s.shipment_id AS shipmentId, o.order_id AS orderId, c.customer_id AS customerId,
       c.name AS customerName, zone.name AS zone, agent.name AS agent, hub.name AS hub,
       s.vehicle_id AS vehicle, s.status AS status, toString(s.shipment_date) AS shipmentDate,
       toString(s.expected_delivery_date) AS expectedDeliveryDate, s.distance_km AS distanceKm,
       0 AS attemptCount, null AS failureProbability, null AS riskLevel`,
    { shipmentId, vehicleId: input.vehicleId ?? null, deliveryTimeWindow: input.deliveryTimeWindow ?? "09:00-18:00", ...input },
  );
  return rows[0];
}

export async function getShipment(shipmentId: string) {
  const rows = await readQuery(
    `MATCH (s:Shipment {shipment_id: $shipmentId})
     OPTIONAL MATCH (o:Order)-[:HAS_SHIPMENT]->(s)
     OPTIONAL MATCH (c:Customer)-[:PLACED]->(o)
     OPTIONAL MATCH (s)-[:DELIVER_TO]->(address:Address)
     OPTIONAL MATCH (s)-[:HAS_ATTEMPT]->(attempt:DeliveryAttempt)
     OPTIONAL MATCH (attempt)-[:FAILED_DUE_TO]->(reason:FailureReason)
     RETURN s.shipment_id AS shipmentId, o.order_id AS orderId, c.customer_id AS customerId,
       coalesce(c.name, 'Unknown') AS customerName, s.status AS status, s.distance_km AS distanceKm,
       toString(s.shipment_date) AS shipmentDate, toString(s.expected_delivery_date) AS expectedDeliveryDate,
       0 AS attemptCount, null AS failureProbability, null AS riskLevel,
       address {.*} AS address,
       collect(DISTINCT attempt {attemptId: attempt.attempt_id, attemptNumber: attempt.attempt_number,
         status: attempt.status, attemptDate: toString(attempt.attempt_date), remarks: attempt.remarks,
         failureReason: reason.reason_name}) AS attempts,
       collect(DISTINCT reason {.*}) AS failureReasons`,
    { shipmentId },
  );
  return rows[0];
}

export async function updateShipmentStatus(shipmentId: string, status: string) {
  const rows = await writeQuery(
    `MATCH (s:Shipment {shipment_id: $shipmentId}) SET s.status = $status
     RETURN s.shipment_id AS shipmentId, s.status AS status`,
    { shipmentId, status },
  );
  return rows[0];
}

export async function recordAttempt(
  shipmentId: string,
  input: { status: string; failureReasonId?: string | null; remarks: string },
) {
  return writeTransaction(async (tx) => {
    const result = (await tx.run(
      `MATCH (s:Shipment {shipment_id: $shipmentId})
       OPTIONAL MATCH (s)-[:HAS_ATTEMPT]->(previous:DeliveryAttempt)
       WITH s, coalesce(max(previous.attempt_number), 0) + 1 AS attemptNumber
       CREATE (a:DeliveryAttempt {
         attempt_id: $attemptId, attempt_number: attemptNumber, attempt_date: date(),
         status: $status, remarks: $remarks
       })
       CREATE (s)-[:HAS_ATTEMPT]->(a)
       SET s.status = CASE WHEN $status = 'SUCCESS' THEN 'DELIVERED' ELSE 'FAILED' END
       WITH s, a
       OPTIONAL MATCH (r:FailureReason {reason_id: $failureReasonId})
       FOREACH (_ IN CASE WHEN r IS NULL THEN [] ELSE [1] END |
         CREATE (a)-[:FAILED_DUE_TO]->(r))
       RETURN a.attempt_id AS attemptId, a.attempt_number AS attemptNumber,
         a.status AS status, toString(a.attempt_date) AS attemptDate,
         a.remarks AS remarks, r.reason_name AS failureReason`,
      { attemptId: `ATT-${randomUUID().slice(0, 8).toUpperCase()}`, shipmentId, failureReasonId: input.failureReasonId ?? null, ...input },
    )) as { records: Neo4jRecordLike[] };
    return result.records[0]?.toObject?.() ?? {};
  });
}

type Neo4jRecordLike = { toObject: () => Record<string, unknown> };

export async function graphForShipment(shipmentId: string) {
  const rows = await readQuery(
    `MATCH path = (s:Shipment {shipment_id: $shipmentId})-[*1..3]-(related)
     WITH collect(path) AS paths
     UNWIND paths AS path
     UNWIND nodes(path) AS node
     WITH collect(DISTINCT node) AS nodes, paths
     UNWIND paths AS path
     UNWIND relationships(path) AS rel
     RETURN
       [node IN nodes | {
         id: coalesce(node.shipment_id, node.customer_id, node.order_id, node.address_id,
           node.agent_id, node.hub_id, node.zone_id, node.attempt_id, node.reason_id, node.prediction_id),
         label: coalesce(node.name, node.shipment_id, node.customer_id, node.order_id, 'Node'),
         type: head(labels(node)), properties: node {.*}
       }] AS nodes,
       collect(DISTINCT {
         source: startNode(rel).shipment_id, target: endNode(rel).shipment_id,
         type: type(rel)
       }) AS relationships`,
    { shipmentId },
  );
  return rows[0] ?? { nodes: [], relationships: [] };
}

export async function analyticsOverview() {
  const [failureByReason, failureByZone, failureByAgent, failureByPayment, distanceRanges, attemptsPerShipment, totals] =
    await Promise.all([
      readQuery(`MATCH (a:DeliveryAttempt)-[:FAILED_DUE_TO]->(r:FailureReason) RETURN r.reason_name AS name, count(a) AS value ORDER BY value DESC`),
      readQuery(`MATCH (s:Shipment)-[:BELONGS_TO_ZONE]->(z:Zone) WITH z.name AS name, count(s) AS total, count(CASE WHEN s.status = 'FAILED' THEN 1 END) AS failed RETURN name, total, failed`),
      readQuery(`MATCH (s:Shipment)-[:ASSIGNED_TO]->(a:DeliveryAgent) WITH a.name AS name, count(s) AS total, count(CASE WHEN s.status = 'FAILED' THEN 1 END) AS failed RETURN name, total, failed ORDER BY failed DESC LIMIT 10`),
      readQuery(`MATCH (o:Order)-[:HAS_SHIPMENT]->(s:Shipment) WITH o.payment_type AS name, count(s) AS total, count(CASE WHEN s.status = 'FAILED' THEN 1 END) AS failed RETURN name, total, failed`),
      readQuery(`MATCH (s:Shipment) WITH CASE WHEN s.distance_km < 5 THEN '0–5 km' WHEN s.distance_km < 15 THEN '5–15 km' ELSE '15+ km' END AS name, count(s) AS total, count(CASE WHEN s.status = 'FAILED' THEN 1 END) AS failed RETURN name, total, failed ORDER BY name`),
      readQuery(`MATCH (s:Shipment)-[:HAS_ATTEMPT]->(a:DeliveryAttempt) WITH s.shipment_id AS name, count(a) AS attempts RETURN name, attempts ORDER BY attempts DESC LIMIT 20`),
      readQuery(`MATCH (s:Shipment) WITH count(s) AS total, count(CASE WHEN s.status = 'DELIVERED' THEN 1 END) AS delivered, count(CASE WHEN s.return_status = 'RETURNED' THEN 1 END) AS returned RETURN total, delivered, returned`),
    ]);
  const total = Number(totals[0]?.total ?? 0);
  return {
    failureByReason, failureByZone, failureByAgent, failureByPayment, distanceRanges, attemptsPerShipment,
    returnRate: total ? Number(totals[0]?.returned ?? 0) / total : 0,
    successRate: total ? Number(totals[0]?.delivered ?? 0) / total : 0,
  };
}

export async function createPrediction(shipmentId: string) {
  const rows = await readQuery(
    `MATCH (s:Shipment {shipment_id: $shipmentId})
     OPTIONAL MATCH (s)-[:HAS_ATTEMPT]->(attempt:DeliveryAttempt)
     OPTIONAL MATCH (s)-[:BELONGS_TO_ZONE]->(z:Zone)
     OPTIONAL MATCH (s)<-[:HAS_SHIPMENT]-(:Order)<-[:PLACED]-(c:Customer)
     RETURN count(attempt) AS previousAttempts,
       count(CASE WHEN attempt.status = 'FAILED' THEN 1 END) AS previousFailedAttempts,
       s.distance_km AS distanceKm, z.risk_level AS zoneRisk,
       c.customer_id AS customerId`,
    { shipmentId },
  );
  const feature = rows[0] ?? {};
  const previousAttempts = Number(feature.previousAttempts ?? 0);
  const previousFailedAttempts = Number(feature.previousFailedAttempts ?? 0);
  const distanceKm = Number(feature.distanceKm ?? 0);
  const zoneRisk = String(feature.zoneRisk ?? "LOW").toUpperCase();
  const probability = Math.min(
    0.98,
    Math.max(
      0.04,
      0.14 + previousFailedAttempts * 0.18 + previousAttempts * 0.06 +
        distanceKm * 0.012 + (zoneRisk === "HIGH" ? 0.18 : zoneRisk === "MEDIUM" ? 0.08 : 0),
    ),
  );
  const riskLevel = probability >= 0.7 ? "HIGH" : probability >= 0.4 ? "MEDIUM" : "LOW";
  const predictionId = `PRED-${randomUUID().slice(0, 8).toUpperCase()}`;
  const prediction = await writeQuery(
    `MATCH (s:Shipment {shipment_id: $shipmentId})
     CREATE (p:Prediction {
       prediction_id: $predictionId, failure_probability: $probability,
       risk_level: $riskLevel, predicted_at: datetime(), model_version: 'graph-features-v1'
     })
     CREATE (s)-[:HAS_PREDICTION]->(p)
     RETURN p.prediction_id AS predictionId, s.shipment_id AS shipmentId,
       p.failure_probability AS failureProbability, p.risk_level AS riskLevel,
       toString(p.predicted_at) AS predictedAt, p.model_version AS modelVersion`,
    { shipmentId, predictionId, probability, riskLevel },
  );
  return {
    ...prediction[0],
    features: { previousAttempts, previousFailedAttempts, distanceKm, zoneRisk },
  };
}

export async function executeOperation(operation: string, shipmentId?: string | null) {
  const operations: Record<string, { query: string; params: Record<string, unknown> }> = {
    filter: { query: `MATCH (s:Shipment) WHERE s.status = 'FAILED' RETURN s.shipment_id AS shipmentId, s.status AS status LIMIT 25`, params: {} },
    sort: { query: `MATCH (s:Shipment) RETURN s.shipment_id AS shipmentId, s.distance_km AS distanceKm ORDER BY s.distance_km DESC LIMIT 25`, params: {} },
    aggregate: { query: `MATCH (s:Shipment) RETURN count(s) AS shipmentCount, avg(s.distance_km) AS averageDistance`, params: {} },
    "group-analysis": { query: `MATCH (s:Shipment) RETURN s.status AS status, count(s) AS shipments ORDER BY shipments DESC`, params: {} },
    "1-hop": { query: `MATCH (s:Shipment {shipment_id: $shipmentId})-[r]-(n) RETURN type(r) AS relationship, labels(n) AS labels, n {.*} AS properties`, params: { shipmentId: shipmentId ?? "" } },
    "2-hop": { query: `MATCH (s:Shipment {shipment_id: $shipmentId})-[*1..2]-(n) RETURN DISTINCT labels(n) AS labels, n {.*} AS properties LIMIT 50`, params: { shipmentId: shipmentId ?? "" } },
    "multi-hop": { query: `MATCH path = (s:Shipment {shipment_id: $shipmentId})-[*1..3]-(n) RETURN [x IN nodes(path) | labels(x)] AS pathLabels LIMIT 25`, params: { shipmentId: shipmentId ?? "" } },
    constraints: { query: `SHOW CONSTRAINTS YIELD name, type, entityType, labelsOrTypes, properties RETURN name, type, entityType, labelsOrTypes, properties`, params: {} },
    indexes: { query: `SHOW INDEXES YIELD name, type, entityType, labelsOrTypes, properties RETURN name, type, entityType, labelsOrTypes, properties`, params: {} },
    transaction: { query: `MATCH (s:Shipment {shipment_id: $shipmentId}) RETURN s.shipment_id AS shipmentId, 'transaction-ready' AS state`, params: { shipmentId: shipmentId ?? "" } },
  };
  const selected = operations[operation];
  if (!selected) throw new Error(`Unsupported DBMS operation: ${operation}`);
  const result = await readQuery(selected.query, selected.params);
  return { operation, query: selected.query, parameters: selected.params, success: true, result, affected: result.length };
}

export async function neo4jStatus() {
  try {
    await checkNeo4j();
    return { status: "connected", database: getDatabaseName(), message: null };
  } catch (error) {
    return {
      status: "unavailable",
      database: getDatabaseName(),
      message: error instanceof Error ? error.message : "Neo4j connection failed.",
    };
  }
}

export async function closeNeo4j() {
  if (getDriver) {
    try {
      await getDriver().close();
    } catch {
      // No-op during process shutdown.
    }
  }
}