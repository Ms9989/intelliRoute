import { Router, type IRouter, type RequestHandler } from "express";
import {
  CreateCustomerBody,
  CreateOrderBody,
  CreateShipmentBody,
  ExecuteDbmsOperationBody,
  LoginBody,
  RecordDeliveryAttemptBody,
  UpdateCustomerBody,
  UpdateShipmentStatusBody,
} from "@workspace/api-zod";
import {
  activity,
  analyticsOverview,
  createCustomer,
  createOrder,
  createPrediction,
  createShipment,
  dashboardSummary,
  deactivateCustomer,
  executeOperation,
  getCustomer,
  getShipment,
  graphForShipment,
  highRisk,
  listCustomers,
  listOrders,
  listShipments,
  logActivity,
  neo4jStatus,
  recordAttempt,
  updateCustomer,
  updateShipmentStatus,
} from "../lib/intelliroute";
import { Neo4jSetupError } from "../lib/neo4j";

const router: IRouter = Router();

function errorMessage(error: unknown) {
  if (error instanceof Neo4jSetupError) return error.message;
  if (error instanceof Error) return error.message;
  return "The operation could not be completed.";
}

function dbRoute(handler: RequestHandler): RequestHandler {
  return async (req, res) => {
    try {
      await handler(req, res, () => undefined);
    } catch (error) {
      req.log.error({ err: error }, "IntelliRoute API operation failed");
      res.status(error instanceof Neo4jSetupError ? 503 : 500).json({
        error: errorMessage(error),
      });
    }
  };
}

router.get("/healthz", async (_req, res) => {
  const neo4j = await neo4jStatus();
  res.json({
    status: neo4j.status === "connected" ? "ok" : "degraded",
    neo4j: neo4j.status,
    message: neo4j.message,
  });
});

router.post("/auth/login", (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a valid role." });
    return;
  }
  res.json({
    role: parsed.data.role,
    userName: parsed.data.role === "Delivery Agent" ? "Aarav Singh" : parsed.data.role,
  });
});

router.get("/dashboard/summary", dbRoute(async (_req, res) => {
  res.json(await dashboardSummary());
}));

router.get("/customers", dbRoute(async (req, res) => {
  res.json(await listCustomers(String(req.query.search ?? "")));
}));

router.post("/customers", dbRoute(async (req, res) => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Name, email, and phone are required." });
    return;
  }
  const customer = await createCustomer(parsed.data);
  await logActivity({
    user: "Operations Manager",
    operation: "CREATE CUSTOMER",
    entity: "Customer",
    action: "CREATE",
    success: true,
    query: "CREATE (c:Customer {...})",
  });
  res.status(201).json(customer);
}));

router.get("/customers/:customerId", dbRoute(async (req, res) => {
  const customer = await getCustomer(String(req.params.customerId));
  if (!customer) {
    res.status(404).json({ error: "Customer not found." });
    return;
  }
  res.json(customer);
}));

router.patch("/customers/:customerId", dbRoute(async (req, res) => {
  const parsed = UpdateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "No valid customer fields were supplied." });
    return;
  }
  const customer = await updateCustomer(String(req.params.customerId), parsed.data);
  if (!customer) {
    res.status(404).json({ error: "Customer not found." });
    return;
  }
  res.json(customer);
}));

router.delete("/customers/:customerId", dbRoute(async (req, res) => {
  await deactivateCustomer(String(req.params.customerId));
  res.status(204).send();
}));

router.get("/orders", dbRoute(async (req, res) => {
  res.json(await listOrders(String(req.query.search ?? "")));
}));

router.post("/orders", dbRoute(async (req, res) => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Customer, amount, payment type, and priority are required." });
    return;
  }
  res.status(201).json(await createOrder(parsed.data));
}));

router.get("/shipments", dbRoute(async (req, res) => {
  res.json(await listShipments(String(req.query.search ?? ""), String(req.query.status ?? "")));
}));

router.post("/shipments", dbRoute(async (req, res) => {
  const parsed = CreateShipmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Order, customer, address, agent, hub, zone, dates, and distance are required." });
    return;
  }
  res.status(201).json(await createShipment(parsed.data));
}));

router.get("/shipments/:shipmentId", dbRoute(async (req, res) => {
  const shipment = await getShipment(String(req.params.shipmentId));
  if (!shipment) {
    res.status(404).json({ error: "Shipment not found." });
    return;
  }
  res.json(shipment);
}));

router.patch("/shipments/:shipmentId/status", dbRoute(async (req, res) => {
  const parsed = UpdateShipmentStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A shipment status is required." });
    return;
  }
  res.json(await updateShipmentStatus(String(req.params.shipmentId), parsed.data.status));
}));

router.post("/shipments/:shipmentId/attempt", dbRoute(async (req, res) => {
  const parsed = RecordDeliveryAttemptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Attempt status and remarks are required." });
    return;
  }
  res.status(201).json(await recordAttempt(String(req.params.shipmentId), parsed.data));
}));

router.get("/shipments/:shipmentId/graph", dbRoute(async (req, res) => {
  res.json(await graphForShipment(String(req.params.shipmentId)));
}));

router.get("/analytics/overview", dbRoute(async (_req, res) => {
  res.json(await analyticsOverview());
}));

router.post("/predictions/:shipmentId", dbRoute(async (req, res) => {
  const prediction = await createPrediction(String(req.params.shipmentId));
  await logActivity({
    user: "Operations Manager",
    operation: "GENERATE PREDICTION",
    entity: "Prediction",
    action: "CREATE",
    success: true,
    query: "CREATE (s)-[:HAS_PREDICTION]->(p:Prediction)",
  });
  res.status(201).json(prediction);
}));

router.get("/predictions/high-risk", dbRoute(async (_req, res) => {
  res.json(await highRisk());
}));

router.get("/dbms/activity", dbRoute(async (_req, res) => {
  res.json(await activity());
}));

router.post("/dbms/operation", dbRoute(async (req, res) => {
  const parsed = ExecuteDbmsOperationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a supported DBMS operation." });
    return;
  }
  const result = await executeOperation(parsed.data.operation, parsed.data.shipmentId);
  res.json(result);
}));

export default router;