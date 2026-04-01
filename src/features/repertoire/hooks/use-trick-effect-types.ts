"use client";

import { useQuery } from "@powersync/react";

interface EffectTypeRow {
  effect_type: string;
}

/**
 * Returns a reactive list of distinct trick effect types from local SQLite,
 * sorted alphabetically. Used for combobox autocomplete in the trick form.
 *
 * Data is re-fetched automatically by PowerSync whenever the `tricks` table changes.
 */
export function useTrickEffectTypes(): string[] {
  const { data } = useQuery<EffectTypeRow>(
    "SELECT DISTINCT effect_type FROM tricks WHERE deleted_at IS NULL AND effect_type IS NOT NULL AND effect_type != '' ORDER BY effect_type ASC"
  );

  return data.map((row) => row.effect_type);
}
