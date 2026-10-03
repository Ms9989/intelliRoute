# IntelliRoute

IntelliRoute is a last-mile delivery operations and analytics platform. It uses a React web app, an Express API, and Neo4j to manage shipments, explore delivery relationships, analyze failure patterns, and record shipment risk predictions. The risk model is an academic prototype, not a production prediction service.

## Features

- Operations dashboard with delivery metrics, activity, and high-risk shipments
- Customer and order management
- Shipment creation, status updates, and delivery-attempt recording
- Graph-based shipment relationship exploration
- Failure analytics and persisted risk predictions
- DBMS Lab for inspecting Cypher queries, parameters, results, and affected records

## Project Structure

```text
.
|-- artifacts/
|   |-- api-server/             Express API and Neo4j access
|   |   `-- src/
|   |       |-- routes/         REST endpoints
|   |       `-- lib/            Query logic, Neo4j driver, logging
|   |-- intelliroute/           Main React and Vite web application
|   |   `-- src/
|   |       |-- components/     Application and shared UI components
|   |       |-- hooks/          React hooks
|   |       |-- lib/            Frontend utilities
|   |       `-- pages/          Page components
|   `-- mockup-sandbox/         Separate UI mockup preview workspace
|-- database/
|   |-- schema.cypher           Neo4j node and relationship schema
|   |-- indexes.cypher          Neo4j indexes and constraints
|   `-- seed.cypher             Deterministic fictional sample data
|-- lib/
|   |-- api-spec/               OpenAPI source specification
|   |-- api-client-react/       Generated React Query API client
|   |-- api-zod/                Generated Zod schemas and types
|   `-- db/                     Shared database package
|-- scripts/                    Workspace scripts
|-- package.json                Root scripts and development tools
|-- pnpm-workspace.yaml         Workspace packages and dependency catalog
`-- pnpm-lock.yaml              Locked workspace dependencies
```

## Technology and Dependencies

- **Workspace:** Node.js 24, pnpm, TypeScript
- **Frontend:** React 19, Vite, Tailwind CSS, Wouter, TanStack Query, Recharts, Radix UI, Framer Motion, Lucide, React Hook Form, and Zod
- **API:** Express 5, the Neo4j JavaScript driver, dotenv, Pino, and Pino HTTP logging
- **API contract:** OpenAPI with generated React Query hooks and Zod validation
- **Database:** Neo4j, available locally or through Neo4j Aura

See the package manifests in the root, `artifacts/api-server/`, `artifacts/intelliroute/`, and `lib/` for the complete dependency lists.

## Requirements

- Node.js 24
- pnpm
- A local Neo4j database or Neo4j Aura database

## Setup and Run

1. Install workspace dependencies:

	```sh
	pnpm install
	```

2. Create a root `.env` from `.env.example` and set the Neo4j connection values:

	```text
	NEO4J_URI=neo4j://localhost:7687
	NEO4J_USERNAME=neo4j
	NEO4J_PASSWORD=<your-local-password>
	NEO4J_DATABASE=neo4j
	PORT=5000
	```

	Keep real credentials in `.env`; do not commit that file.

3. In Neo4j Browser or Cypher Shell, run `database/schema.cypher`, then `database/indexes.cypher`, then `database/seed.cypher`.

4. Start the API and frontend together:

	```sh
	pnpm dev
	```

	Open `http://localhost:5173`. The Vite server proxies `/api` to `http://localhost:5000` by default. Set `API_SERVER_URL` if the API runs elsewhere.

## Common Commands

```sh
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/intelliroute run typecheck
```

Check `http://localhost:5173/api/healthz` to verify API connectivity. The health response should report `status: "ok"` and `neo4j: "connected"`.

## Data and Security Notes

- Neo4j is the source of truth for customers, orders, shipments, graph relationships, analytics, audit logs, and predictions.
- The frontend calls the REST API; Neo4j credentials belong only in the API environment.
- API-side Cypher queries are parameterized.
- The seed script creates deterministic fictional records. Back up any database before running it against non-development data.
