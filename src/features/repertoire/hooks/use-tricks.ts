"use client";

import { useQuery } from "@powersync/react";
import type { ParsedTrick } from "../types";
import { parseTrickRow, type TrickRow } from "./parse-trick";

interface UseTricksOptions {
  category?: string | null;
  search?: string;
  sort?:
    | "name_asc"
    | "name_desc"
    | "newest"
    | "oldest"
    | "difficulty"
    | "status";
  status?: string | null;
}

interface UseTricksResult {
  error: Error | null;
  isLoading: boolean;
  tricks: ParsedTrick[];
}

const SORT_CLAUSES: Record<NonNullable<UseTricksOptions["sort"]>, string> = {
  name_asc: "name ASC",
  name_desc: "name DESC",
  newest: "created_at DESC",
  oldest: "created_at ASC",
  difficulty: "difficulty DESC NULLS LAST",
  status: "status ASC",
};

/**
 * Builds the SQL query and parameters for fetching tricks with optional
 * filtering by search term, status, and category, plus configurable sort order.
 */
export function buildTricksQuery(options: UseTricksOptions = {}): {
  sql: string;
  params: unknown[];
} {
  const { search, status, category, sort = "newest" } = options;

  const conditions: string[] = ["deleted_at IS NULL"];
  const params: unknown[] = [];

  if (search) {
    conditions.push(
      "(name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')"
    );
    const escaped = search.replace(/[%_\\]/g, "\\$&");
    const pattern = `%${escaped}%`;
    params.push(pattern, pattern);
  }

  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }

  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }

  const whereClause = conditions.join(" AND ");
  const orderClause = SORT_CLAUSES[sort];
  const sql = `SELECT * FROM tricks WHERE ${whereClause} ORDER BY ${orderClause}`;

  return { sql, params };
}

/**
 * Returns a reactive list of tricks from local SQLite, with optional
 * filtering by search term, status, and category, plus configurable sort order.
 *
 * Data is re-fetched automatically by PowerSync whenever the underlying
 * `tricks` table changes (inserts, updates, deletes).
 */
export function useTricks(options: UseTricksOptions = {}): UseTricksResult {
  const { sql, params } = buildTricksQuery(options);

  const { data, isLoading, error } = useQuery<TrickRow>(sql, params);

  const tricks = data.map(parseTrickRow);

  return { tricks, isLoading, error: error ?? null };
}

export type { UseTricksOptions, UseTricksResult };
