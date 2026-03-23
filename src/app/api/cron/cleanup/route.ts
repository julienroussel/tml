import "server-only";
import { timingSafeEqual } from "node:crypto";
import { Pool } from "@neondatabase/serverless";
import { type NextRequest, NextResponse } from "next/server";
import { quoteId, type SyncedTableName } from "@/sync/queries";

/**
 * Daily cron job that hard-deletes rows soft-deleted more than 30 days ago.
 *
 * Order matters due to foreign key constraints:
 * 1. Junction tables first (they reference parent tables)
 * 2. Parent tables second
 * 3. Goals last (references tricks via nullable FK)
 *
 * Each table DELETE runs independently (no wrapping transaction). This
 * avoids full ROLLBACK when LIMIT 10000 leaves surviving junction rows
 * that block parent DELETEs via NO ACTION FKs. Tables whose DELETEs fail
 * (typically due to FK violations from surviving children) are logged and
 * retried on the next cron run.
 *
 * Auth: Vercel Cron sends an Authorization header with the CRON_SECRET.
 */

const CRON_SECRET = process.env.CRON_SECRET;

function verifySecret(header: string | null, secret: string): boolean {
  if (!header) {
    return false;
  }
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

/** Tables in deletion order — junctions first, then parents. */
const TABLES_IN_ORDER = [
  "item_tricks",
  "routine_tricks",
  "practice_session_tricks",
  "items",
  "routines",
  "practice_sessions",
  "performances",
  "goals",
  "tricks",
] as const satisfies readonly SyncedTableName[];

const RETENTION_DAYS = 30;

// Vercel Cron Jobs invoke route handlers via GET requests.
// This route performs DELETE mutations despite being a GET handler.
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Vercel Cron passes the secret as Authorization: Bearer <secret>
  const authHeader = request.headers.get("authorization");
  if (!(CRON_SECRET && verifySecret(authHeader, CRON_SECRET))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 500 }
    );
  }

  const results: Record<string, number> = {};
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 10_000,
  });

  const errors: Record<string, string> = {};

  try {
    const client = await pool.connect();
    try {
      // Each table DELETE runs independently — no wrapping transaction.
      // With LIMIT 10000 and NO ACTION FKs, a single transaction would
      // ROLLBACK entirely if surviving junction rows block a parent DELETE.
      // Independent deletes let junction rows drain first; parents whose
      // children are still present survive until the next cron run.
      for (const table of TABLES_IN_ORDER) {
        try {
          // SAFETY: `table` is from TABLES_IN_ORDER (compile-time constant).
          // RETENTION_DAYS is parameterized via $1. LIMIT prevents long queries.
          const quotedTable = quoteId(table);
          const result = await client.query(
            `WITH to_delete AS (SELECT id FROM ${quotedTable} WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '1 day' * $1 LIMIT 10000) DELETE FROM ${quotedTable} WHERE id IN (SELECT id FROM to_delete)`,
            [RETENTION_DAYS]
          );
          results[table] = result.rowCount ?? 0;
        } catch (tableError: unknown) {
          // FK violations are expected when junction rows survive due to LIMIT.
          // Log and continue — these parents will be cleaned next run.
          const message =
            tableError instanceof Error
              ? tableError.message
              : String(tableError);
          console.error(`Cleanup failed for table "${table}":`, message);
          errors[table] = "cleanup_failed";
          results[table] = 0;
        }
      }

      const totalDeleted = Object.values(results).reduce((a, b) => a + b, 0);

      console.log("Soft-delete cleanup completed:", {
        totalDeleted,
        errors: Object.keys(errors).length > 0 ? errors : undefined,
        ...results,
      });

      const errorsCount = Object.keys(errors).length;

      return NextResponse.json({
        success: true,
        totalDeleted,
        errorsCount,
      });
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    console.error("Soft-delete cleanup failed:", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  } finally {
    await pool.end();
  }
}
