"use client";

import { useQuery } from "@powersync/react";
import { useRef } from "react";
import type { ItemId } from "@/db/types";
import type { ParsedItem } from "../types";
import { type ItemRow, parseItemRow } from "./parse-item";

interface UseItemResult {
  error: Error | null;
  hasSettled: boolean;
  isLoading: boolean;
  item: ParsedItem | null;
}

/**
 * Returns a single item by ID from local SQLite.
 * Returns null when id is null (creating new item).
 *
 * @returns
 *   item       - Parsed row, or null if not yet loaded / genuinely absent /
 *                stale (returned row's id doesn't match the requested id).
 *   isLoading  - True while the query is in flight. Folds `isFetching` to
 *                bridge PowerSync's query-param-change race; flickers true on
 *                unrelated `items`-table re-emits — do NOT use as a "row
 *                confirmed missing" signal.
 *   hasSettled - True once the query has produced at least one non-loading /
 *                non-fetching result for the current id. Sticky through
 *                subsequent isFetching flickers. Use this (not !isLoading) to
 *                detect "row confirmed missing" (#287).
 *   error      - Query error, or null.
 */
export function useItem(id: ItemId | null): UseItemResult {
  const sql = id
    ? "SELECT * FROM items WHERE id = ? AND deleted_at IS NULL"
    : "SELECT 1 WHERE 0";
  const params = id ? [id] : [];

  const { data, isLoading, isFetching, error } = useQuery<ItemRow>(sql, params);

  // Per-id settle latch. Resets on id change so a prior id's settle doesn't
  // bleed across A→null→A (sheet close + reopen) or A→B (target switch).
  // Sticky once latched for the current id so subsequent isFetching flickers
  // on unrelated `items`-table re-emits don't unset hasSettled (issue #287).
  // Ref bookkeeping runs BEFORE the null-id early return so refs stay coherent
  // across id↔null transitions.
  //
  // Mutating refs during render is the correct pattern here: hasSettled must
  // be observable in the SAME render that detects the settled transition (a
  // useEffect would land a frame too late and the collect-view close+toast
  // effect would miss it). Both mutations below are idempotent — re-running
  // the render with the same inputs reaches the same ref state — which is
  // what React requires for render-time ref writes to be safe.
  const settledIdRef = useRef<ItemId | null>(null);
  const lastIdRef = useRef<ItemId | null | undefined>(undefined);
  if (lastIdRef.current !== id) {
    lastIdRef.current = id;
    settledIdRef.current = null;
  }
  // Cross-check data identity before latching: PowerSync's useWatchedQuery can
  // briefly report stale (!isLoading && !isFetching) on the first render after
  // an id change, while `data` still holds the previous query's row. Without
  // the id-match, hasSettled would latch true for the new id during the stale
  // window. The return value below mirrors the same guard, so `item` and
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
    return { item: null, isLoading: false, error: null, hasSettled: false };
  }

  // Mirror the latch's id-match guard on the returned value: when PowerSync
  // briefly reports a stale row for the previous query after an id change,
  // surface null rather than the old row. Keeps `item` and `hasSettled` on
  // the same trust boundary — a settled-true result is the value for `id`.
  const row = firstRow && firstRow.id === id ? firstRow : null;
  const item = row ? parseItemRow(row) : null;

  // Fold isFetching into isLoading to bridge PowerSync's query-param-change race. See use-trick.ts for the full rationale.
  return {
    item,
    isLoading: isLoading || isFetching,
    error: error ?? null,
    hasSettled,
  };
}
