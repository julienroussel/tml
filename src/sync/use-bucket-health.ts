"use client";

import { useQuery, useStatus } from "@powersync/react";
import { useEffect } from "react";
import { readGlobalOverride } from "./test-override-key";

interface BucketCountRow {
  count: number | string;
}

interface UseBucketHealthResult {
  error: Error | null;
  hasServerBuckets: boolean;
  isLoading: boolean;
}

function isUseBucketHealthResult(
  value: unknown
): value is UseBucketHealthResult {
  if (value === null || typeof value !== "object") {
    return false;
  }
  if (
    !("hasServerBuckets" in value) ||
    typeof value.hasServerBuckets !== "boolean"
  ) {
    return false;
  }
  if (!("isLoading" in value) || typeof value.isLoading !== "boolean") {
    return false;
  }
  if (!("error" in value)) {
    return false;
  }
  const errorValue = value.error;
  return errorValue === null || errorValue instanceof Error;
}

// Module-level dedup. Logged once per (error.message) for the lifetime of the
// page; survives remount/navigation; cleared on full reload. Replaces the
// previous per-hook-instance `useRef`, which re-logged every time a component
// using `useBucketHealth` mounted (e.g. navigating between routes that both
// render `SyncStatus`).
const loggedBucketHealthErrors = new Set<string>();

/**
 * Test-only escape hatch to reset the module-level error-dedup Set so a
 * test can verify the keying contract ("dedup is keyed on `error.message`")
 * without leaking state across cases. Gated on NODE_ENV — the export is a
 * no-op in production bundles and dead-code-eliminates with the Set lookup
 * inside it. Do NOT call from production code.
 */
export function __resetLoggedBucketHealthErrorsForTests(): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  loggedBucketHealthErrors.clear();
}

function readTestOverride(): UseBucketHealthResult | null {
  // NODE_ENV check gates the entire branch — under production builds the
  // bundler tree-shakes the import + lookup below since they're unreachable.
  // The E2E spec and unit tests import the same canonical constant, so a
  // rename can never desync the key the hook checks vs. the key tests set.
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  const candidate = readGlobalOverride();
  return isUseBucketHealthResult(candidate) ? candidate : null;
}

/**
 * Reports whether the PowerSync client has received any server-side buckets.
 *
 * PowerSync always creates a `$local` placeholder bucket in `ps_buckets` to
 * hold un-uploaded local writes. The first time the server delivers a sync
 * stream for the user, real buckets appear alongside it — that's the signal
 * that downloads are actually flowing, not just that the WebSocket connected.
 *
 * Consumed by SyncStatus to distinguish "Online" (connected + buckets
 * arriving) from "degraded" (connected + only `$local` exists — the server
 * stream subscribed but produces no data, e.g. when sync rules aren't
 * deployed on the target instance). See #332 for the silent-failure recipe.
 *
 * NOTE: bound to PowerSync SDK internals. `ps_buckets` is not a public
 * contract — if the SDK renames or restructures it in a future version, the
 * query will fail.
 *
 * When the query errors, useBucketHealth logs once **per distinct
 * error.message at module scope** via console.error and surfaces `error`
 * to the consumer. The dedup survives remount and route navigation; it
 * resets only on a full page reload. The consumer (deriveSyncKey in
 * sync-status.tsx) maps a non-null `error` OR an absence of server buckets
 * to the `degraded` pill state, not `error` — staying fail-safe against
 * PowerSync SDK changes to ps_buckets. Verify the table still exists
 * after each @powersync/web upgrade.
 *
 * The query subscription is gated on `useStatus().connected` so the watch
 * does not fire on every local write while the user is offline.
 */
export function useBucketHealth(): UseBucketHealthResult {
  // Gate the live query on connection state so offline sessions don't pay
  // the cost of a reactive watch on a table that can't produce new rows
  // until sync starts. Hook order is preserved (useQuery always runs) — the
  // SQL is swapped to a no-op `LIMIT 0` form when disconnected.
  //
  // Trade-off: each connect↔disconnect transition re-prepares the watched
  // query (the SQL text differs across renders). Net win for sustained-
  // offline sessions; on a flapping connection the re-prepare cost can
  // approach the saved cost.
  const { connected } = useStatus();
  const sql = connected
    ? "SELECT COUNT(*) AS count FROM ps_buckets WHERE name != '$local'"
    : "SELECT 0 AS count WHERE 0 LIMIT 0";
  const { data, isLoading, error } = useQuery<BucketCountRow>(sql);

  // The logging effect intentionally watches the LIVE `error` (not the test
  // override). Override mode is dev/E2E only — SDK breakage on `ps_buckets`
  // should still surface in the console even while a test forces a specific
  // hasServerBuckets/error pair on the consumer side.
  //
  // Dedup is keyed on `error.message` at module scope: logged once per
  // distinct error message for the lifetime of the page (survives remount and
  // navigation; cleared on full reload). Replaces the per-hook-instance ref
  // that re-logged whenever a consumer remounted (e.g. route navigation).
  useEffect(() => {
    if (error === null || error === undefined) {
      return;
    }
    const key = error.message;
    if (loggedBucketHealthErrors.has(key)) {
      return;
    }
    loggedBucketHealthErrors.add(key);
    console.error("[bucket-health] query failed", error);
  }, [error]);

  const override = readTestOverride();
  if (override !== null) {
    return override;
  }

  // `data` can be undefined during the first render before the watch fires;
  // coerce to [] so `rows[0]?.count` is safe.
  const rows = data ?? [];
  return {
    hasServerBuckets: Number(rows[0]?.count ?? 0) > 0,
    isLoading,
    error: error ?? null,
  };
}
