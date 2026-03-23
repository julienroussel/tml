import "server-only";
import { Pool } from "@neondatabase/serverless";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth/server";
import type { SqlParam } from "@/sync/queries";
import {
  buildQuery,
  coerceOpRecord,
  isSyncedTable,
  OpType,
  SYNCED_COLUMNS,
} from "@/sync/queries";

/**
 * Batch mutation endpoint for the PowerSync connector.
 *
 * Instead of sending N individual HTTP requests to the Neon Data API
 * (one per mutation), the connector sends a single batch request here.
 * Each operation is validated, converted to parameterized SQL server-side,
 * and executed inside a single transaction.
 *
 * 4xx-equivalent errors (constraint violations) are caught per-operation
 * and reported in the response so the connector can handle them as
 * permanent errors.
 */

const MAX_BATCH_SIZE = 1000;

interface BatchOperation {
  id: string;
  op: OpType;
  opData?: Record<string, unknown>;
  table: string;
}

interface BatchRequest {
  operations: BatchOperation[];
}

interface OperationResult {
  error?: string;
  index: number;
  rolledBack?: boolean;
  status: number;
}

interface QueryClient {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDatabaseError(
  error: unknown
): error is { code: string; message: string } {
  if (!isRecord(error)) {
    return false;
  }
  return typeof error.code === "string" && typeof error.message === "string";
}

/** Postgres error codes that indicate permanent client errors. */
const PERMANENT_PG_ERROR_CODES = new Set([
  "23505", // unique_violation
  "23503", // foreign_key_violation
  "23502", // not_null_violation
  "23514", // check_violation
  "22P02", // invalid_text_representation
  "22003", // numeric_value_out_of_range
]);

function isPermanentDbError(
  error: unknown
): error is { code: string; message: string } {
  return isDatabaseError(error) && PERMANENT_PG_ERROR_CODES.has(error.code);
}

type BatchResult =
  | { ok: true; results: OperationResult[] }
  | {
      ok: false;
      failedIndex: number;
      message: string;
      results: OperationResult[];
    };

function buildOperationQuery(
  operation: BatchOperation,
  userId: string
): { params: SqlParam[]; query: string } {
  const { table, op, id, opData } = operation;

  if (!isSyncedTable(table)) {
    throw new Error(`Disallowed table: ${table}`);
  }

  // DELETE operations don't use record data — they only set deleted_at/updated_at
  if (op === OpType.DELETE) {
    return buildQuery(op, table, id, {}, userId);
  }

  const record = coerceOpRecord(opData, id, table);

  // Force the authenticated user_id — never trust the client value
  const hasUserId = SYNCED_COLUMNS[table].has("user_id");
  if (hasUserId) {
    record.user_id = userId;
  }

  return buildQuery(op, table, id, record, userId);
}

declare global {
  var __batchPool: Pool | undefined;
}

let __poolUrl: string | undefined;

/**
 * Pool singleton — survives HMR via globalThis.
 * pool.end() is intentionally never called: Neon's serverless driver handles
 * connection cleanup on instance teardown, and Vercel recycles function instances.
 */
function getPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL not configured");
  }
  if (globalThis.__batchPool && __poolUrl === databaseUrl) {
    return globalThis.__batchPool;
  }
  // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op — old pool cleanup is best-effort
  globalThis.__batchPool?.end().catch(() => {});
  __poolUrl = databaseUrl;
  globalThis.__batchPool = new Pool({
    connectionString: databaseUrl,
    // Allow a few concurrent connections on warm instances to avoid serializing
    // requests. Kept small since each Vercel function instance handles limited
    // concurrency and Neon has its own connection limits.
    max: 3,
  });
  return globalThis.__batchPool;
}

/** Try to rollback a savepoint; return false if the connection itself is broken. */
async function rollbackSavepoint(
  client: QueryClient,
  sp: string
): Promise<boolean> {
  try {
    await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    return true;
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op — original error is more important
    await client.query("ROLLBACK").catch(() => {});
    return false;
  }
}

type OperationOutcome =
  | { continue: true; result: OperationResult }
  | { continue: false; batch: BatchResult };

/** Execute a single operation inside a savepoint, returning the outcome. */
async function executeOperation(
  client: QueryClient,
  operation: BatchOperation,
  index: number,
  userId: string,
  results: OperationResult[]
): Promise<OperationOutcome> {
  // Build the query before entering the savepoint — validation errors
  // (disallowed columns, non-primitive values, missing opData) are permanent
  // client errors, not transient DB failures. Treating them as 422 prevents
  // PowerSync from retrying a bad mutation indefinitely.
  let query: string;
  let params: unknown[];
  try {
    ({ query, params } = buildOperationQuery(operation, userId));
  } catch (error: unknown) {
    console.error(
      `Validation error on operation ${index} (table: ${operation.table}, op: ${operation.op}):`,
      error instanceof Error ? error.message : String(error)
    );
    return {
      continue: true,
      result: { index, status: 422, error: "Validation error" },
    };
  }

  const sp = `"sp_${index}"`;
  await client.query(`SAVEPOINT ${sp}`);
  try {
    await client.query(query, params);
    await client.query(`RELEASE SAVEPOINT ${sp}`);
    return { continue: true, result: { index, status: 200 } };
  } catch (error: unknown) {
    if (!isPermanentDbError(error)) {
      console.error(
        `Transient DB error on operation ${index} (table: ${operation.table}, op: ${operation.op}):`,
        error instanceof Error ? error.message : String(error)
      );
      await client.query("ROLLBACK");
      return {
        continue: false,
        batch: {
          ok: false,
          failedIndex: index,
          message: "Internal error",
          results: results.map((r) => ({ ...r, rolledBack: true })),
        },
      };
    }

    const rolledBack = await rollbackSavepoint(client, sp);
    if (!rolledBack) {
      return {
        continue: false,
        batch: {
          ok: false,
          failedIndex: index,
          message: "Connection error during savepoint rollback",
          results,
        },
      };
    }
    console.error(
      `Permanent DB error on operation ${index} (table: ${operation.table}, op: ${operation.op}):`,
      error.message
    );
    return {
      continue: true,
      result: { index, status: 422, error: "Constraint violation" },
    };
  }
}

async function executeBatch(
  pool: Pool,
  operations: BatchOperation[],
  userId: string
): Promise<BatchResult> {
  const results: OperationResult[] = [];
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Each operation is wrapped in a SAVEPOINT so that permanent DB errors
    // (constraint violations) can be caught and rolled back without aborting
    // the entire transaction. PostgreSQL puts the transaction in an aborted
    // state after any error — SAVEPOINTs allow recovery.
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      if (!operation) {
        continue;
      }

      const outcome = await executeOperation(
        client,
        operation,
        i,
        userId,
        results
      );
      if (!outcome.continue) {
        return outcome.batch;
      }
      results.push(outcome.result);
    }

    await client.query("COMMIT");
    return { ok: true, results };
  } catch (error: unknown) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback errors — the original error is more important
    }
    throw error;
  } finally {
    client.release();
  }
}

const VALID_OP_TYPES = new Set<OpType>([
  OpType.PUT,
  OpType.PATCH,
  OpType.DELETE,
]);

function isValidOperation(value: unknown): value is BatchOperation {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    typeof value.op === "string" &&
    (VALID_OP_TYPES as ReadonlySet<string>).has(value.op) &&
    typeof value.table === "string" &&
    isSyncedTable(value.table)
  );
}

type ParseResult =
  | { ok: true; data: BatchRequest }
  | { ok: false; error: string };

function parseBody(raw: unknown): ParseResult {
  if (!isRecord(raw)) {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  if (!Array.isArray(raw.operations) || raw.operations.length === 0) {
    return { ok: false, error: "No operations provided" };
  }
  if (raw.operations.length > MAX_BATCH_SIZE) {
    return {
      ok: false,
      error: `Batch size ${raw.operations.length} exceeds maximum ${MAX_BATCH_SIZE}`,
    };
  }
  const rawOperations: unknown[] = raw.operations;
  const operations = rawOperations.filter(isValidOperation);
  if (operations.length !== rawOperations.length) {
    const firstInvalidIndex = rawOperations.findIndex(
      (op) => !isValidOperation(op)
    );
    return {
      ok: false,
      error: `Operation at index ${firstInvalidIndex} is malformed`,
    };
  }
  return { ok: true, data: { operations } };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type");
  if (!contentType?.startsWith("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseBody(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const body = parsed.data;

  let pool: Pool;
  try {
    pool = getPool();
  } catch {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 500 }
    );
  }

  try {
    const result = await executeBatch(pool, body.operations, session.user.id);
    if (!result.ok) {
      console.error(
        `Batch execution failed at index ${result.failedIndex}:`,
        result.message
      );
      return NextResponse.json(
        {
          error: "Batch execution failed",
          failedIndex: result.failedIndex,
          results: result.results,
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ results: result.results });
  } catch (error: unknown) {
    console.error("Unhandled batch execution error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
