"use client";

import { useQuery } from "@powersync/react";

interface CategoryRow {
  category: string;
}

/**
 * Returns a reactive list of distinct trick categories from local SQLite,
 * sorted alphabetically. Used for combobox autocomplete in the trick form.
 *
 * Data is re-fetched automatically by PowerSync whenever the `tricks` table changes.
 */
export function useTrickCategories(): string[] {
  const { data } = useQuery<CategoryRow>(
    "SELECT DISTINCT category FROM tricks WHERE deleted_at IS NULL AND category IS NOT NULL AND category != '' ORDER BY category ASC"
  );

  return data.map((row) => row.category);
}
