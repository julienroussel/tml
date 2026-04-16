"use client";

import { useQuery } from "@powersync/react";

interface BrandRow {
  brand: string;
}

interface UseItemBrandsResult {
  brands: string[];
  error: Error | null;
}

/**
 * Returns a reactive list of distinct brand values from the user's items.
 * Used for combobox suggestions in the item form.
 */
export function useItemBrands(): UseItemBrandsResult {
  const { data, error } = useQuery<BrandRow>(
    "SELECT DISTINCT brand FROM items WHERE deleted_at IS NULL AND brand IS NOT NULL AND brand != '' ORDER BY brand ASC"
  );

  return { brands: data.map((row) => row.brand), error: error ?? null };
}
