"use client";

import { useQuery } from "@powersync/react";
import type { ItemId } from "@/db/types";
import type { ParsedItem } from "../types";
import { type ItemRow, parseItemRow } from "./parse-item";

interface UseItemResult {
  error: Error | null;
  isLoading: boolean;
  item: ParsedItem | null;
}

/**
 * Returns a single item by ID from local SQLite.
 * Returns null when id is null (creating new item).
 */
export function useItem(id: ItemId | null): UseItemResult {
  const sql = id
    ? "SELECT * FROM items WHERE id = ? AND deleted_at IS NULL"
    : "SELECT 1 WHERE 0";
  const params = id ? [id] : [];

  const { data, isLoading, error } = useQuery<ItemRow>(sql, params);

  const row = data[0];
  const item = row ? parseItemRow(row) : null;

  return { item, isLoading, error: error ?? null };
}
