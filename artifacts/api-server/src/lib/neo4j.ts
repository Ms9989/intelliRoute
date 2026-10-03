import neo4j, { type Driver, type Record as Neo4jRecord } from "neo4j-driver";

let driver: Driver | null = null;

export class Neo4jSetupError extends Error {
  constructor(message = "Neo4j is not configured.") {
    super(message);
    this.name = "Neo4jSetupError";
  }
}

export function isNeo4jConfigured() {
  return Boolean(
    process.env.NEO4J_URI &&
      process.env.NEO4J_USERNAME &&
      process.env.NEO4J_PASSWORD,
  );
}

export function getDatabaseName() {
  return process.env.NEO4J_DATABASE || "neo4j";
}

export function getDriver() {
  if (!isNeo4jConfigured()) {
    throw new Neo4jSetupError(
      "Add NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD to connect IntelliRoute to Neo4j.",
    );
  }

  if (!driver) {
    driver = neo4j.driver(
      process.env.NEO4J_URI!,
      neo4j.auth.basic(
        process.env.NEO4J_USERNAME!,
        process.env.NEO4J_PASSWORD!,
      ),
    );
  }

  return driver;
}

function normalize(value: unknown): unknown {
  if (neo4j.isInt(value)) {
    return value.toNumber();
  }
  if (
    neo4j.isDate(value) ||
    neo4j.isDateTime(value) ||
    neo4j.isLocalDateTime(value) ||
    neo4j.isTime(value) ||
    neo4j.isLocalTime(value)
  ) {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  if (value && typeof value === "object") {
    if (value instanceof Date) return value.toISOString();
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalize(item)]),
    );
  }
  return value;
}

export function recordToObject(record: Neo4jRecord) {
  return normalize(record.toObject()) as Record<string, unknown>;
}

export async function readQuery<T = Record<string, unknown>>(
  query: string,
  params: Record<string, unknown> = {},
) {
  const session = getDriver().session({ database: getDatabaseName() });
  try {
    const result = await session.executeRead((tx) => tx.run(query, params));
    return result.records.map((record) => recordToObject(record) as T);
  } finally {
    await session.close();
  }
}

export async function writeQuery<T = Record<string, unknown>>(
  query: string,
  params: Record<string, unknown> = {},
) {
  const session = getDriver().session({ database: getDatabaseName() });
  try {
    const result = await session.executeWrite((tx) => tx.run(query, params));
    return result.records.map((record) => recordToObject(record) as T);
  } finally {
    await session.close();
  }
}

export async function writeTransaction<T>(
  work: (tx: { run: (query: string, params?: Record<string, unknown>) => Promise<unknown> }) => Promise<T>,
) {
  const session = getDriver().session({ database: getDatabaseName() });
  try {
    return await session.executeWrite(async (tx) => {
      const transaction = {
        run: (query: string, params: Record<string, unknown> = {}) =>
          tx.run(query, params),
      };
      return work(transaction);
    });
  } finally {
    await session.close();
  }
}

export async function checkNeo4j() {
  const currentDriver = getDriver();
  await currentDriver.verifyConnectivity();
  return true;
}