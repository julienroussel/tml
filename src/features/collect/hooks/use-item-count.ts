"use client";

import { useQuery } from "@powersync/react";

interface CountRow {
  count: number;
}

interface UseItemCountResult {
  count: number;
  error: Error | null;
  isLoading: boolean;
}

/**
 * Returns a reactive count of the user's live (non-soft-deleted) items from
 * local SQLite. Used by the dashboard CollectionCard so its number stays
 * consistent with `/collect` (both read from PowerSync — offline-first).
 */
export function useItemCount(): UseItemCountResult {
  const { data, isLoading, error } = useQuery<CountRow>(
    "SELECT COUNT(*) AS count FROM items WHERE deleted_at IS NULL"
  );

  // Defensive Number() cast: PowerSync's SQLite driver returns INTEGER columns
  // as JS numbers in practice, but COUNT(*) is the first such query in this
  // codebase and ICU plural selectors fall through to `other` if `count` is a
  // string. A 30-byte cast removes the entire risk class.
  return {
    count: Number(data[0]?.count ?? 0),
    isLoading,
    error: error ?? null,
  };
}
