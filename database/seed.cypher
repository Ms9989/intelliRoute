// Fictional, repeatable IntelliRoute dataset.
// Run database/schema.cypher and database/indexes.cypher first.

UNWIND [
  ['FR-1', 'Customer unavailable', 'Customer', 'Customer was not available during the time window.'],
  ['FR-2', 'Incorrect address', 'Address', 'The delivery address could not be located or was incomplete.'],
  ['FR-3', 'Customer rejected delivery', 'Customer', 'The customer declined the delivery at the door.'],
  ['FR-4', 'Vehicle issue', 'Fleet', 'Vehicle breakdown or operational issue delayed the route.'],
  ['FR-5', 'Weather delay', 'External', 'Weather conditions made the route unsafe.'],
  ['FR-6', 'Damaged package', 'Package', 'The package was damaged before handoff.'],
  ['FR-7', 'Hub delay', 'Hub', 'The shipment missed its planned hub dispatch window.'],
  ['FR-8', 'Agent unavailable', 'Workforce', 'The assigned delivery agent was unavailable.']
] AS row
MERGE (r:FailureReason {reason_id: row[0]})
SET r.reason_name = row[1], r.category = row[2], r.description = row[3];

UNWIND range(1, 6) AS i
MERGE (h:Hub {hub_id: 'HUB-' + toString(i)})
SET h.name = 'Central Hub ' + toString(i), h.city = ['Mumbai', 'Pune', 'Delhi', 'Bengaluru', 'Hyderabad'][i - 1],
    h.capacity = 500 + i * 75;

UNWIND range(1, 8) AS i
MERGE (z:Zone {zone_id: 'ZONE-' + toString(i)})
SET z.name = 'Zone ' + toString(i), z.city = ['Mumbai', 'Pune', 'Delhi', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata'][i - 1],
    z.risk_level = CASE WHEN i IN [2, 5] THEN 'HIGH' WHEN i IN [3, 7] THEN 'MEDIUM' ELSE 'LOW' END;

UNWIND range(1, 15) AS i
MERGE (a:DeliveryAgent {agent_id: 'AGT-' + toString(i)})
SET a.name = ['Aarav Singh', 'Meera Nair', 'Kabir Shah', 'Ishita Rao', 'Vihaan Das', 'Anaya Menon', 'Arjun Iyer', 'Diya Kapoor', 'Rohan Jain', 'Tara Bose', 'Neil Thomas', 'Myra Kulkarni', 'Advik Sen', 'Sara Pillai'][i - 1],
    a.phone = '+91-90000-' + toString(10000 + i), a.vehicle_type = CASE WHEN i % 3 = 0 THEN 'Van' ELSE 'Bike' END,
    a.availability = 'AVAILABLE';

UNWIND range(1, 12) AS i
MERGE (v:Vehicle {vehicle_id: 'VEH-' + toString(i)})
SET v.vehicle_number = 'MH-' + toString(10 + i) + '-RT-' + toString(1000 + i),
    v.vehicle_type = CASE WHEN i % 3 = 0 THEN 'Van' ELSE 'Bike' END,
    v.capacity = CASE WHEN i % 3 = 0 THEN 80 ELSE 20 END, v.status = 'AVAILABLE';

UNWIND range(1, 100) AS i
MERGE (c:Customer {customer_id: 'CUS-' + toString(i)})
SET c.name = 'Customer ' + toString(i), c.email = 'customer' + toString(i) + '@example.test',
    c.phone = '+91-91000-' + toString(10000 + i), c.status = 'ACTIVE',
    c.created_at = date() - duration({days: 100 + i});
MERGE (address:Address {address_id: 'ADR-' + toString(i)})
SET address.street = toString(10 + i) + ' Market Road', address.city = ['Mumbai', 'Pune', 'Delhi', 'Bengaluru'][i % 4],
    address.state = 'Maharashtra', address.pincode = toString(400000 + i),
    address.latitude = 18.50 + (i % 20) / 100.0, address.longitude = 73.80 + (i % 20) / 100.0,
    address.address_type = 'HOME'
CREATE (c)-[:HAS_ADDRESS]->(address);

UNWIND range(1, 250) AS i
MATCH (c:Customer {customer_id: 'CUS-' + toString(1 + (i % 100))})
CREATE (o:Order {
  order_id: 'ORD-' + toString(i), order_date: date() - duration({days: i % 90}),
  amount: 350 + (i % 20) * 125, payment_type: CASE WHEN i % 3 = 0 THEN 'COD' ELSE 'PREPAID' END,
  priority: CASE WHEN i % 8 = 0 THEN 'EXPRESS' ELSE 'STANDARD' END,
  status: 'READY'
})
CREATE (c)-[:PLACED]->(o)
CREATE (item:OrderItem {item_id: 'ITEM-' + toString(i), product_name: ['Home essentials', 'Electronics accessory', 'Personal care', 'Grocery pack'][i % 4], quantity: 1 + (i % 3), price: 350 + (i % 20) * 125})
CREATE (o)-[:CONTAINS]->(item);

UNWIND range(1, 250) AS i
MATCH (o:Order {order_id: 'ORD-' + toString(i)}), (c:Customer)-[:PLACED]->(o),
  (address:Address {address_id: 'ADR-' + toString(1 + (i % 100))}),
  (agent:DeliveryAgent {agent_id: 'AGT-' + toString(1 + (i % 15))}),
  (hub:Hub {hub_id: 'HUB-' + toString(1 + (i % 6))}),
  (zone:Zone {zone_id: 'ZONE-' + toString(1 + (i % 8))}),
  (vehicle:Vehicle {vehicle_id: 'VEH-' + toString(1 + (i % 12))})
CREATE (s:Shipment {
  shipment_id: 'SHP-' + toString(i), shipment_date: date() - duration({days: i % 45}),
  expected_delivery_date: date() - duration({days: (i % 45) - 2}),
  actual_delivery_date: CASE WHEN i % 9 IN [0, 1] THEN null ELSE date() - duration({days: i % 45}) END,
  status: CASE WHEN i % 9 IN [0, 1] THEN 'FAILED' WHEN i % 7 = 0 THEN 'RETURNED' ELSE 'DELIVERED' END,
  distance_km: 2.5 + (i % 30) * 0.8, delivery_time_window: CASE WHEN i % 2 = 0 THEN '09:00-13:00' ELSE '14:00-18:00' END,
  vehicle_id: vehicle.vehicle_id, return_status: CASE WHEN i % 7 = 0 THEN 'RETURNED' ELSE 'NOT_RETURNED' END
})
CREATE (o)-[:HAS_SHIPMENT]->(s)
CREATE (s)-[:DELIVER_TO]->(address)
CREATE (s)-[:ASSIGNED_TO]->(agent)
CREATE (s)-[:ROUTED_THROUGH]->(hub)
CREATE (s)-[:BELONGS_TO_ZONE]->(zone)
CREATE (s)-[:USES_VEHICLE]->(vehicle)
CREATE (hub)-[:SERVES]->(zone)
CREATE (agent)-[:WORKS_AT]->(hub);

MATCH (s:Shipment)
WHERE toInteger(substring(s.shipment_id, 4)) % 2 = 0
WITH s, toInteger(substring(s.shipment_id, 4)) AS i
CREATE (a:DeliveryAttempt {
  attempt_id: 'ATT-' + toString(i) + '-1', attempt_number: 1, attempt_date: s.shipment_date,
  status: CASE WHEN s.status = 'FAILED' THEN 'FAILED' ELSE 'SUCCESS' END,
  remarks: CASE WHEN s.status = 'FAILED' THEN 'First attempt unsuccessful' ELSE 'Delivered to customer' END
})
CREATE (s)-[:HAS_ATTEMPT]->(a)
WITH s, a, i
MATCH (r:FailureReason {reason_id: 'FR-' + toString(1 + (i % 8))})
FOREACH (_ IN CASE WHEN a.status = 'FAILED' THEN [1] ELSE [] END | CREATE (a)-[:FAILED_DUE_TO]->(r));

MATCH (s:Shipment)
WHERE s.status = 'FAILED'
WITH s, toInteger(substring(s.shipment_id, 4)) AS i
CREATE (p:Prediction {
  prediction_id: 'PRED-' + toString(i), failure_probability: 0.68 + (i % 4) * 0.07,
  risk_level: CASE WHEN i % 4 = 0 THEN 'MEDIUM' ELSE 'HIGH' END,
  predicted_at: datetime(), model_version: 'seed-graph-features-v1'
})
CREATE (s)-[:HAS_PREDICTION]->(p);

MERGE (a:AuditLog {audit_id: 'AUD-SEED'})
SET a.timestamp = datetime(), a.user = 'System', a.operation = 'SEED DATABASE',
    a.entity = 'Graph', a.action = 'CREATE', a.success = true,
    a.query = 'UNWIND range(...) seed graph';