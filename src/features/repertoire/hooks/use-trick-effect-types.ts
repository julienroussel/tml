"use client";

import { useQuery } from "@powersync/react";

interface EffectTypeRow {
  effect_type: string;
}

interface UseTrickEffectTypesResult {
  effectTypes: string[];
  error: Error | null;
}

/**
 * Returns a reactive list of distinct trick effect types from local SQLite,
 * sorted alphabetically. Used for combobox autocomplete in the trick form.
 *
 * Data is re-fetched automatically by PowerSync whenever the `tricks` table changes.
 */
export function useTrickEffectTypes(): UseTrickEffectTypesResult {
  const { data, error } = useQuery<EffectTypeRow>(
    "SELECT DISTINCT effect_type FROM tricks WHERE deleted_at IS NULL AND effect_type IS NOT NULL AND effect_type != '' ORDER BY effect_type ASC"
  );

  return {
    effectTypes: data.map((row) => row.effect_type),
    error: error ?? null,
  };
}
