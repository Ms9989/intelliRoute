# IntelliRoute

IntelliRoute is a graph-based last-mile delivery operations platform that uses Neo4j to connect shipment workflows, relationship exploration, failure analytics, and academic DBMS demonstrations.

## Run & Operate

- `pnpm install` — install workspace dependencies
- `pnpm --filter @workspace/api-server run dev` — run the API server on its managed port
- `pnpm --filter @workspace/intelliroute run dev` — run the web application on its managed port
- `pnpm run typecheck` — full TypeScript check across the workspace
- `pnpm --filter @workspace/api-spec run codegen` — regenerate typed API helpers after changing `lib/api-spec/openapi.yaml`

Required Neo4j environment:

- `NEO4J_URI`
- `NEO4J_USERNAME`
- `NEO4J_PASSWORD`
- `NEO4J_DATABASE` (optional; defaults to `neo4j`)

Run `database/schema.cypher`, `database/indexes.cypher`, and `database/seed.cypher` in Neo4j before using operational screens. Without those settings, the app intentionally shows a Neo4j setup state instead of serving fake operational data.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React, Vite, Tailwind CSS, Wouter, React Query, Recharts
- API: Express 5 and the Neo4j JavaScript driver
- Contract: OpenAPI with Orval-generated React Query hooks and Zod schemas
- Graph database: Neo4j local or Aura

## Where things live

- `artifacts/intelliroute/` — runnable React web application
- `artifacts/api-server/` — REST API and Neo4j gateway
- `lib/api-spec/openapi.yaml` — source-of-truth API contract
- `lib/api-client-react/` — generated frontend hooks
- `lib/api-zod/` — generated request and response validation
- `database/` — Neo4j schema, indexes, seed data, and setup notes

## Architecture decisions

- Neo4j is the source of truth for customers, orders, shipments, graph relationships, analytics, audit logs, and predictions.
- The frontend only calls REST routes; Neo4j credentials stay in the API process.
- Cypher is parameterized and grouped behind reusable API-side query functions.
- The risk prototype uses interpretable graph-derived features and persists each prediction as a `Prediction` node connected to its shipment. It is an academic prototype, not a production model.

## Product

- Operations dashboard with live metrics, grouped analytics, activity, and high-risk shipments
- Customer and order CRUD surfaces
- Shipment creation, status updates, delivery attempt recording, and failure reasons
- Multi-hop shipment graph exploration
- Failure analytics and persisted risk predictions
- DBMS Lab showing Cypher, parameters, results, affected records, and activity

## Gotchas

- Do not replace Neo4j operational data with PostgreSQL or hardcoded arrays.
- Regenerate API hooks after every OpenAPI change.
- Use the managed artifact workflows rather than creating duplicate local workflows.
- If the preview reports no operational data, check `/api/healthz` and the Neo4j environment values first.