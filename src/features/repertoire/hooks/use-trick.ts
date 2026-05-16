"use client";

import { useQuery } from "@powersync/react";
import type { TrickId } from "@/db/types";
import type { ParsedTrick } from "../types";
import { parseTrickRow, type TrickRow } from "./parse-trick";

interface UseTrickResult {
  error: Error | null;
  isLoading: boolean;
  trick: ParsedTrick | null;
}

/**
 * Returns a single trick by ID from local SQLite. When `id` is null, the
 * query is effectively disabled and returns `null` immediately.
 *
 * Data is re-fetched automatically by PowerSync whenever the underlying
 * row changes.
 */
export function useTrick(id: TrickId | null): UseTrickResult {
  const sql = id
    ? "SELECT * FROM tricks WHERE id = ? AND deleted_at IS NULL"
    : "SELECT 1 WHERE 0";
  const { data, isLoading, isFetching, error } = useQuery<TrickRow>(
    sql,
    id ? [id] : []
  );

  if (!id) {
    return { trick: null, isLoading: false, error: null };
  }

  const first = data[0];
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
  };
}
