// IntelliRoute property graph schema.
// Run constraints before seed.cypher. Neo4j 5 syntax is used.

CREATE CONSTRAINT customer_id_unique IF NOT EXISTS
FOR (n:Customer) REQUIRE n.customer_id IS UNIQUE;
CREATE CONSTRAINT address_id_unique IF NOT EXISTS
FOR (n:Address) REQUIRE n.address_id IS UNIQUE;
CREATE CONSTRAINT order_id_unique IF NOT EXISTS
FOR (n:Order) REQUIRE n.order_id IS UNIQUE;
CREATE CONSTRAINT order_item_id_unique IF NOT EXISTS
FOR (n:OrderItem) REQUIRE n.item_id IS UNIQUE;
CREATE CONSTRAINT shipment_id_unique IF NOT EXISTS
FOR (n:Shipment) REQUIRE n.shipment_id IS UNIQUE;
CREATE CONSTRAINT agent_id_unique IF NOT EXISTS
FOR (n:DeliveryAgent) REQUIRE n.agent_id IS UNIQUE;
CREATE CONSTRAINT hub_id_unique IF NOT EXISTS
FOR (n:Hub) REQUIRE n.hub_id IS UNIQUE;
CREATE CONSTRAINT zone_id_unique IF NOT EXISTS
FOR (n:Zone) REQUIRE n.zone_id IS UNIQUE;
CREATE CONSTRAINT vehicle_id_unique IF NOT EXISTS
FOR (n:Vehicle) REQUIRE n.vehicle_id IS UNIQUE;
CREATE CONSTRAINT attempt_id_unique IF NOT EXISTS
FOR (n:DeliveryAttempt) REQUIRE n.attempt_id IS UNIQUE;
CREATE CONSTRAINT reason_id_unique IF NOT EXISTS
FOR (n:FailureReason) REQUIRE n.reason_id IS UNIQUE;
CREATE CONSTRAINT prediction_id_unique IF NOT EXISTS
FOR (n:Prediction) REQUIRE n.prediction_id IS UNIQUE;
CREATE CONSTRAINT audit_id_unique IF NOT EXISTS
FOR (n:AuditLog) REQUIRE n.audit_id IS UNIQUE;