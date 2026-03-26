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

/** Tables in deletion order — junctions first, then parents.
 *  Users are handled separately (see user cleanup below).
 *
 *  Note: user_preferences and push_subscriptions are intentionally omitted —
 *  they lack deleted_at columns and are cleaned up via CASCADE when the
 *  owning user row is hard-deleted. */
const TABLES_IN_ORDER = [
  "item_tricks",
  "setlist_tricks",
  "practice_session_tricks",
  "trick_tags",
  "items",
  "setlists",
  "practice_sessions",
  "performances",
  "goals",
  "tags",
  "tricks",
] as const satisfies readonly SyncedTableName[];

/** User-owned tables whose rows need tombstones before a user is
 *  hard-deleted. When a user is soft-deleted, their children may not
 *  have been individually soft-deleted. The pre-pass sets deleted_at on
 *  non-tombstoned children so PowerSync can sync the deletions to
 *  offline clients. These children will be hard-deleted on a future
 *  cron run after their own retention period expires. */
const USER_OWNED_TABLES = [
  "goals",
  "item_tricks",
  "items",
  "performances",
  "practice_session_tricks",
  "practice_sessions",
  "setlist_tricks",
  "setlists",
  "tags",
  "trick_tags",
  "tricks",
] as const satisfies readonly SyncedTableName[];

const RETENTION_DAYS = 30;

interface CleanupClient {
  query(sql: string, params?: unknown[]): Promise<{ rowCount: number | null }>;
}

/**
 * Pre-pass: soft-delete children of users who are past the retention
 * window but whose children were never individually soft-deleted.
 * Without this, hard-deleting the user row would CASCADE-delete
 * children without creating tombstones, leaving orphaned rows in
 * PowerSync offline clients.
 *
 * Note: Banned users (banned_at IS NOT NULL) are excluded. Their data
 * accumulates intentionally to preserve the ban record for audit and
 * re-registration blocking. Admin intervention is required to purge
 * a banned user's data.
 */
async function tombstoneOrphanedChildren(client: CleanupClient): Promise<void> {
  for (const table of USER_OWNED_TABLES) {
    try {
      const quotedTable = quoteId(table);
      await client.query(
        `UPDATE ${quotedTable} SET deleted_at = NOW(), updated_at = NOW() WHERE user_id IN (SELECT id FROM "users" WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '1 day' * $1 AND banned_at IS NULL) AND deleted_at IS NULL`,
        [RETENTION_DAYS]
      );
    } catch (prePassError: unknown) {
      const message =
        prePassError instanceof Error
          ? prePassError.message
          : String(prePassError);
      console.error(
        `Pre-pass soft-delete failed for table "${table}":`,
        message
      );
    }
  }
}

/**
 * Main cleanup: hard-delete rows from synced tables that have been
 * soft-deleted for longer than the retention period.
 */
async function cleanupSyncedTables(
  client: CleanupClient,
  results: Record<string, number>,
  errors: Record<string, string>
): Promise<void> {
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
        tableError instanceof Error ? tableError.message : String(tableError);
      console.error(`Cleanup failed for table "${table}":`, message);
      errors[table] = "cleanup_failed";
      results[table] = 0;
    }
  }
}

/**
 * Hard-delete user rows only when ALL their tombstoned children have
 * already been hard-deleted. Checks for surviving tombstoned rows
 * (deleted_at IS NOT NULL) rather than all rows, so the NOT EXISTS
 * subqueries can leverage the idx_*_deleted_at partial indexes instead
 * of falling back to sequential scans on the partial user_id indexes
 * (which exclude soft-deleted rows).
 */
async function cleanupUsers(
  client: CleanupClient,
  results: Record<string, number>,
  errors: Record<string, string>
): Promise<void> {
  try {
    const childChecks = USER_OWNED_TABLES.map(
      (t) =>
        `NOT EXISTS (SELECT 1 FROM ${quoteId(t)} WHERE user_id = "users".id AND deleted_at IS NOT NULL)`
    ).join(" AND ");
    const result = await client.query(
      `WITH to_delete AS (SELECT id FROM "users" WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '1 day' * $1 AND banned_at IS NULL AND ${childChecks} LIMIT 10000) DELETE FROM "users" WHERE id IN (SELECT id FROM to_delete)`,
      [RETENTION_DAYS]
    );
    results.users = result.rowCount ?? 0;
  } catch (userError: unknown) {
    const message =
      userError instanceof Error ? userError.message : String(userError);
    console.error('Cleanup failed for table "users":', message);
    errors.users = "cleanup_failed";
    results.users = 0;
  }
}

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
      await tombstoneOrphanedChildren(client);
      await cleanupSyncedTables(client, results, errors);
      await cleanupUsers(client, results, errors);

      const totalDeleted = Object.values(results).reduce((a, b) => a + b, 0);

      console.log("Soft-delete cleanup completed:", {
        totalDeleted,
        errors: Object.keys(errors).length > 0 ? errors : undefined,
        ...results,
      });

      const errorsCount = Object.keys(errors).length;
      const resultCount = Object.keys(results).length;
      const allFailed = resultCount > 0 && errorsCount === resultCount;

      return NextResponse.json({
        success: !allFailed,
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
