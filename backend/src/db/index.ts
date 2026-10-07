import { Pool, type QueryResult, type QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL must be configured in production");
}

export const db = new Pool({
  connectionString: connectionString || "postgresql://postgres:postgres@localhost:5432/veilora",
  connectionTimeoutMillis: 45_000,
  options: "-c search_path=public",
});

export const pool = db;

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  return db.query<T>(text, params);
}
