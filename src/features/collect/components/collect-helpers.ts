import { asItemId, asTagId, asTrickId, type ItemId } from "@/db/types";
import type { ParsedTag } from "@/features/repertoire/types";
import type { LinkedTrick } from "../types";

/**
 * UUID v1-v5 regex. Validates at the trust boundary where untyped strings
 * from PowerSync's local SQLite enter the typed domain — the brand
 * constructors (asItemId, asTagId, asTrickId) are deliberately type-only
 * casts, so runtime validation lives here.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Row shape returned by the item_tags + tags join query. */
export interface ItemTagRow {
  color: string | null;
  item_id: string;
  tag_id: string;
  tag_name: string;
}

/** Row shape returned by the item_tricks + tricks join query. */
export interface ItemTrickRow {
  item_id: string;
  trick_id: string;
  trick_name: string;
}

/**
 * Builds a Map from item ID to its parsed tags, given the raw join rows.
 * Runs on every render but the data set is small (local SQLite) and the
 * React Compiler handles memoization automatically.
 *
 * Rows whose `item_id` or `tag_id` are not valid UUIDs are skipped (the
 * trust boundary where untyped sync rows enter the typed domain).
 */
export function buildItemTagMap(rows: ItemTagRow[]): Map<ItemId, ParsedTag[]> {
  const map = new Map<ItemId, ParsedTag[]>();

  for (const row of rows) {
    if (!(isUuid(row.item_id) && isUuid(row.tag_id))) {
      console.warn("[buildItemTagMap] Invalid UUID in row, skipping", {
        item_id: isUuid(row.item_id) ? row.item_id : "invalid",
        tag_id: isUuid(row.tag_id) ? row.tag_id : "invalid",
      });
      continue;
    }

    const itemId = asItemId(row.item_id);
    const tag: ParsedTag = {
      id: asTagId(row.tag_id),
      name: row.tag_name,
      color: row.color,
    };

    const existing = map.get(itemId);
    if (existing) {
      existing.push(tag);
    } else {
      map.set(itemId, [tag]);
    }
  }

  return map;
}

/**
 * Builds a Map from item ID to its linked tricks, given the raw join rows.
 *
 * Rows whose `item_id` or `trick_id` are not valid UUIDs are skipped (the
 * trust boundary where untyped sync rows enter the typed domain).
 */
export function buildItemTrickMap(
  rows: ItemTrickRow[]
): Map<ItemId, LinkedTrick[]> {
  const map = new Map<ItemId, LinkedTrick[]>();

  for (const row of rows) {
    if (!(isUuid(row.item_id) && isUuid(row.trick_id))) {
      console.warn("[buildItemTrickMap] Invalid UUID in row, skipping", {
        item_id: isUuid(row.item_id) ? row.item_id : "invalid",
        trick_id: isUuid(row.trick_id) ? row.trick_id : "invalid",
      });
      continue;
    }

    const itemId = asItemId(row.item_id);
    const trick: LinkedTrick = {
      id: asTrickId(row.trick_id),
      name: row.trick_name,
    };

    const existing = map.get(itemId);
    if (existing) {
      existing.push(trick);
    } else {
      map.set(itemId, [trick]);
    }
  }

  return map;
}
