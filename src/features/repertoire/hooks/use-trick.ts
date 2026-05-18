"use client";

import { useQuery } from "@powersync/react";
import { useRef } from "react";
import type { TrickId } from "@/db/types";
import type { ParsedTrick } from "../types";
import { parseTrickRow, type TrickRow } from "./parse-trick";

interface UseTrickResult {
  error: Error | null;
  hasSettled: boolean;
  isLoading: boolean;
  trick: ParsedTrick | null;
}

/**
 * Returns a single trick by ID from local SQLite. When `id` is null, the
 * query is effectively disabled and returns `null` immediately.
 *
 * Data is re-fetched automatically by PowerSync whenever the underlying
 * row changes.
 *
 * @returns
 *   trick      - Parsed row, or null if not yet loaded / genuinely absent /
 *                stale (returned row's id doesn't match the requested id).
 *   isLoading  - True while the query is in flight. Folds `isFetching` to
 *                bridge PowerSync's query-param-change race; flickers true on
 *                unrelated `tricks`-table re-emits — do NOT use as a "row
 *                confirmed missing" signal.
 *   hasSettled - True once the query has produced at least one non-loading /
 *                non-fetching result for the current id. Sticky through
 *                subsequent isFetching flickers. Use this (not !isLoading) to
 *                detect "row confirmed missing" (#287).
 *   error      - Query error, or null.
 */
export function useTrick(id: TrickId | null): UseTrickResult {
  const sql = id
    ? "SELECT * FROM tricks WHERE id = ? AND deleted_at IS NULL"
    : "SELECT 1 WHERE 0";
  const { data, isLoading, isFetching, error } = useQuery<TrickRow>(
    sql,
    id ? [id] : []
  );

  // Per-id settle latch. Resets on id change so a prior id's settle doesn't
  // bleed across A→null→A (sheet close + reopen) or A→B (target switch).
  // Sticky once latched for the current id so subsequent isFetching flickers
  // on unrelated `tricks`-table re-emits don't unset hasSettled (issue #287).
  // Ref bookkeeping runs BEFORE the null-id early return so refs stay coherent
  // across id↔null transitions.
  //
  // Mutating refs during render is the correct pattern here: hasSettled must
  // be observable in the SAME render that detects the settled transition (a
  // useEffect would land a frame too late and the repertoire-view close+toast
  // effect would miss it). Both mutations below are idempotent — re-running
  // the render with the same inputs reaches the same ref state — which is
  // what React requires for render-time ref writes to be safe.
  const settledIdRef = useRef<TrickId | null>(null);
  const lastIdRef = useRef<TrickId | null | undefined>(undefined);
  if (lastIdRef.current !== id) {
    lastIdRef.current = id;
    settledIdRef.current = null;
  }
  // Cross-check data identity before latching: PowerSync's useWatchedQuery can
  // briefly report stale (!isLoading && !isFetching) on the first render after
  // an id change, while `data` still holds the previous query's row. Without
  // the id-match, hasSettled would latch true for the new id during the stale
  // window. The return value below mirrors the same guard, so `trick` and
  // `hasSettled` agree on what counts as "the value for id". Empty data is a
  // valid settle (row not found / deleted).
  const firstRow = data[0];
  if (
    id !== null &&
    !isLoading &&
    !isFetching &&
    (firstRow === undefined || firstRow.id === id)
  ) {
    settledIdRef.current = id;
  }
  const hasSettled = id !== null && settledIdRef.current === id;

  if (id === null) {
    return { trick: null, isLoading: false, error: null, hasSettled: false };
  }

  // Mirror the latch's id-match guard on the returned value: when PowerSync
  // briefly reports a stale row for the previous query after an id change,
  // surface null rather than the old row. Keeps `trick` and `hasSettled` on
  // the same trust boundary — a settled-true result is the value for `id`.
  const first = firstRow && firstRow.id === id ? firstRow : null;
  const trick = first ? parseTrickRow(first) : null;

  // `isLoading` alone is unreliable across a query-param change: PowerSync's
  // useWatchedQuery reports the *previous* query's `isLoading` (often false) on
  // the first render after `id` changes, with `isFetching` covering that gap.
  // Fold both so callers get a dependable "row still in flight" signal — the
  // edit-target loading state in repertoire-view depends on this (issue #217).
  return {
    trick,
    isLoading: isLoading || isFetching,
    error: error ?? null,
    hasSettled,
  };
}
