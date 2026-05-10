"use client";

import { useQuery } from "@powersync/react";

interface CategoryRow {
  category: string;
}

interface UseTrickCategoriesResult {
  categories: string[];
  error: Error | null;
}

/**
 * Returns a reactive list of distinct trick categories from local SQLite,
 * sorted alphabetically. Used for combobox autocomplete in the trick form.
 *
 * Data is re-fetched automatically by PowerSync whenever the `tricks` table changes.
 */
export function useTrickCategories(): UseTrickCategoriesResult {
  const { data, error } = useQuery<CategoryRow>(
    "SELECT DISTINCT category FROM tricks WHERE deleted_at IS NULL AND category IS NOT NULL AND category != '' ORDER BY category ASC"
  );

  return {
    categories: data.map((row) => row.category),
    error: error ?? null,
  };
}
