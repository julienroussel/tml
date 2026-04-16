"use client";

import { useQuery } from "@powersync/react";

interface LocationRow {
  location: string;
}

interface UseItemLocationsResult {
  error: Error | null;
  locations: string[];
}

/**
 * Returns a reactive list of distinct location values from the user's items.
 * Used for combobox suggestions in the item form.
 */
export function useItemLocations(): UseItemLocationsResult {
  const { data, error } = useQuery<LocationRow>(
    "SELECT DISTINCT location FROM items WHERE deleted_at IS NULL AND location IS NOT NULL AND location != '' ORDER BY location ASC"
  );

  return { locations: data.map((row) => row.location), error: error ?? null };
}
