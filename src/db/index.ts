import "server-only";
import { neon } from "@neondatabase/serverless";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle } from "drizzle-orm/neon-http";
// biome-ignore lint/performance/noNamespaceImport: Drizzle requires namespace import for schema
import * as schema from "./schema";

function createDb(): NeonHttpDatabase<typeof schema> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  const sql = neon(databaseUrl);
  return drizzle({ client: sql, schema });
}

type Database = ReturnType<typeof createDb>;

// Next.js dev mode HMR creates fresh module instances on every edit, so
// module-scoped variables lose state between reloads. Storing the singleton
// on globalThis preserves the database connection across HMR cycles.
declare global {
  var db: Database | undefined;
}

function getDb(): Database {
  if (!globalThis.db) {
    globalThis.db = createDb();
  }
  return globalThis.db;
}

export type { Database };
export { getDb };
