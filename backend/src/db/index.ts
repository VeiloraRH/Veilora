import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL must be configured in production");
}

export const db = new Pool({
  connectionString: connectionString || "postgresql://postgres:postgres@localhost:5432/veilora",
  connectionTimeoutMillis: 45_000,
  options: "-c search_path=public",
});
