"use client";

import { useQuery } from "@powersync/react";

interface CountRow {
  count: number;
}

interface UseTrickCountResult {
  count: number;
  error: Error | null;
  isLoading: boolean;
}

/**
 * Returns a reactive count of the user's live (non-soft-deleted) tricks from
 * local SQLite. Used by the dashboard RepertoireCard so its number stays
 * consistent with `/repertoire` (both read from PowerSync — offline-first).
 */
export function useTrickCount(): UseTrickCountResult {
  const { data, isLoading, error } = useQuery<CountRow>(
    "SELECT COUNT(*) AS count FROM tricks WHERE deleted_at IS NULL"
  );

  // Defensive Number() cast — see use-item-count.ts for rationale (ICU plural
  // selectors require a number; PowerSync's COUNT return type is not yet
  // empirically pinned in this codebase).
  return {
    count: Number(data[0]?.count ?? 0),
    isLoading,
    error: error ?? null,
  };
}
