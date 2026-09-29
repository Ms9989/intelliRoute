# IntelliRoute Neo4j setup

IntelliRoute keeps operational data in Neo4j. PostgreSQL is not used as a fallback for customers, orders, shipments, analytics, or predictions.

1. Create a local Neo4j database or a Neo4j Aura instance.
2. Set `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, and optionally `NEO4J_DATABASE` in the Replit Secrets panel or a local `.env`.
3. Run `schema.cypher`, then `indexes.cypher`, then `seed.cypher` in Neo4j Browser or Cypher Shell.
4. Restart the API server and open `/api/healthz`. It should report `status: "ok"` and `neo4j: "connected"`.

The seed script creates fictional records only. It is intentionally deterministic so a student can re-run it after clearing a local database. Do not run the seed script against a production graph without taking a backup first.

## Model

Nodes include `Customer`, `Address`, `Order`, `OrderItem`, `Shipment`, `DeliveryAgent`, `Hub`, `Zone`, `Vehicle`, `DeliveryAttempt`, `FailureReason`, `Prediction`, and `AuditLog`.

Core relationships include `HAS_ADDRESS`, `PLACED`, `CONTAINS`, `HAS_SHIPMENT`, `DELIVER_TO`, `ASSIGNED_TO`, `ROUTED_THROUGH`, `BELONGS_TO_ZONE`, `USES_VEHICLE`, `HAS_ATTEMPT`, `FAILED_DUE_TO`, `HAS_PREDICTION`, `SERVES`, and `WORKS_AT`.