"use client";

import { useQuery } from "@powersync/react";
import type { SqlParam } from "@/sync/queries";
import type { FilterSortValue, ItemCondition, ItemType } from "../constants";
import type { ParsedItem } from "../types";
import { type ItemRow, parseItemRow } from "./parse-item";

interface UseItemsOptions {
  condition?: ItemCondition | null;
  search?: string;
  sort?: FilterSortValue;
  type?: ItemType | null;
}

interface UseItemsResult {
  error: Error | null;
  isLoading: boolean;
  items: ParsedItem[];
}

const SORT_CLAUSES = {
  newest: "created_at DESC",
  oldest: "created_at ASC",
  "name-asc": "name ASC",
  "name-desc": "name DESC",
  "price-asc": "CAST(purchase_price AS REAL) ASC NULLS LAST",
  "price-desc": "CAST(purchase_price AS REAL) DESC NULLS LAST",
  "type-asc": "type ASC, name ASC",
} as const satisfies Record<FilterSortValue, string>;

/**
 * Builds the SQL query and parameters for fetching items with optional
 * filtering by search term, type, and condition, plus configurable sort order.
 */
export function buildItemsQuery(options: UseItemsOptions = {}): {
  sql: string;
  params: SqlParam[];
} {
  const { search, type, condition, sort = "newest" } = options;

  const conditions: string[] = ["deleted_at IS NULL"];
  const params: SqlParam[] = [];

  if (search) {
    conditions.push(
      "(name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR brand LIKE ? ESCAPE '\\')"
    );
    const escaped = search.replace(/[%_\\]/g, "\\$&");
    const pattern = `%${escaped}%`;
    params.push(pattern, pattern, pattern);
  }

  if (type) {
    conditions.push("type = ?");
    params.push(type);
  }

  if (condition) {
    conditions.push("condition = ?");
    params.push(condition);
  }

  const whereClause = conditions.join(" AND ");
  // Defense-in-depth: even though `sort` is typed as FilterSortValue, fall
  // back to "newest" for unknown keys (e.g. stale URL params or bad state)
  // so the query never reaches `ORDER BY undefined`.
  const orderClause = SORT_CLAUSES[sort] ?? SORT_CLAUSES.newest;
  const sql = `SELECT * FROM items WHERE ${whereClause} ORDER BY ${orderClause}`;

  return { sql, params };
}

/**
 * Returns a reactive list of items from local SQLite, with optional
 * filtering by search term, type, and condition, plus configurable sort order.
 *
 * Data is re-fetched automatically by PowerSync whenever the underlying
 * `items` table changes (inserts, updates, deletes).
 */
export function useItems(options: UseItemsOptions = {}): UseItemsResult {
  const { sql, params } = buildItemsQuery(options);

  const { data, isLoading, error } = useQuery<ItemRow>(sql, params);

  // parseItemRow returns null for rows with invalid UUIDs (defense-in-depth at
  // the sync boundary). Filter them out so consumers see a clean ParsedItem[].
  const items = data
    .map(parseItemRow)
    .filter((item): item is ParsedItem => item !== null);

  return { items, isLoading, error: error ?? null };
}

export type { UseItemsOptions, UseItemsResult };
