"use client";

import { useQuery } from "@powersync/react";
import type { ParsedTrick } from "../types";
import { parseTrickRow, type TrickRow } from "./parse-trick";

interface UseTrickResult {
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
export function useTrick(id: string | null): UseTrickResult {
  const sql = id
    ? "SELECT * FROM tricks WHERE id = ? AND deleted_at IS NULL"
    : "SELECT 1 WHERE 0";
  const { data, isLoading } = useQuery<TrickRow>(sql, id ? [id] : []);

  if (!id) {
    return { trick: null, isLoading: false };
  }

  const first = data[0];
  const trick = first ? parseTrickRow(first) : null;

  return { trick, isLoading };
}
