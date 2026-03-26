"use client";

import { useQuery } from "@powersync/react";
import type { TagId } from "@/db/types";
import type { ParsedTag } from "../types";

interface TagRow {
  color: string | null;
  id: string;
  name: string;
}

interface UseTagsResult {
  isLoading: boolean;
  tags: ParsedTag[];
}

/**
 * Returns all of the user's tags from local SQLite, sorted alphabetically.
 * Used for the tag picker when editing tricks.
 *
 * Data is re-fetched automatically by PowerSync whenever the `tags` table changes.
 */
export function useTags(): UseTagsResult {
  const { data, isLoading } = useQuery<TagRow>(
    "SELECT id, name, color FROM tags WHERE deleted_at IS NULL ORDER BY name ASC"
  );

  const tags: ParsedTag[] = data.map((row) => ({
    id: row.id as TagId,
    name: row.name,
    color: row.color,
  }));

  return { tags, isLoading };
}
