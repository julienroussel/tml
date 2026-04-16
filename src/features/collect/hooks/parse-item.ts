import { asItemId } from "@/db/types";
import {
  type ItemCondition,
  type ItemType,
  isItemCondition,
  isItemType,
} from "../constants";
import type { ParsedItem } from "../types";

/**
 * UUID v1-v5 regex. Validates at the trust boundary where untyped strings
 * from PowerSync's local SQLite enter the typed domain — the brand
 * constructors (asItemId, asTagId, asTrickId) are deliberately type-only
 * casts, so runtime validation lives here.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ItemRow {
  brand: string | null;
  condition: string | null;
  created_at: string;
  creator: string | null;
  description: string | null;
  id: string;
  location: string | null;
  name: string;
  notes: string | null;
  purchase_date: string | null;
  /** Stored as text in PowerSync to preserve numeric(10,2) precision. */
  purchase_price: string | null;
  /**
   * Defensively typed as `number | string | null` because the PowerSync WASM
   * bridge has been observed to return integer columns as strings in some
   * environments. The server schema declares this NOT NULL with default 1, but
   * the test suite (parse-item.test.ts) actively exercises both string and
   * null inputs via the bridge — keep this type until the upstream behavior
   * is verified consistent across all SDK versions.
   */
  quantity: number | string | null;
  type: string;
  updated_at: string;
  url: string | null;
}

function parseQuantity(value: number | string | null, rowId: string): number {
  if (typeof value === "number") {
    return value;
  }
  if (value === null) {
    return 1;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    console.warn("[parseItemRow] NaN quantity coerced to 1", {
      id: rowId,
      field: "quantity",
    });
    return 1;
  }
  return parsed;
}

/**
 * Parses a raw PowerSync `items` row into a typed `ParsedItem`.
 *
 * Returns `null` when `row.id` is not a valid UUID — callers must filter
 * these out (e.g. `rows.map(parseItemRow).filter((x) => x !== null)`). The
 * contract change from `ParsedItem` to `ParsedItem | null` closes the trust
 * gap at the sync boundary that the brand constructors deliberately leave
 * open (they're documented as type-only casts).
 */
export function parseItemRow(row: ItemRow): ParsedItem | null {
  if (typeof row.id !== "string" || !UUID_RE.test(row.id)) {
    console.warn("[parseItemRow] Invalid item id, skipping row", {
      id: typeof row.id === "string" ? `${row.id.slice(0, 8)}...` : null,
    });
    return null;
  }

  let type: ItemType;
  if (isItemType(row.type)) {
    type = row.type;
  } else {
    console.warn("[parseItemRow] Unknown type coerced to 'other'", {
      id: row.id,
      field: "type",
    });
    type = "other";
  }

  let condition: ItemCondition | null = null;
  if (row.condition !== null) {
    if (isItemCondition(row.condition)) {
      condition = row.condition;
    } else {
      console.warn("[parseItemRow] Unknown condition coerced to null", {
        id: row.id,
        field: "condition",
      });
    }
  }

  let purchasePrice: number | null = null;
  if (row.purchase_price !== null) {
    const parsed = Number.parseFloat(row.purchase_price);
    if (Number.isNaN(parsed)) {
      console.warn("[parseItemRow] NaN purchase_price coerced to null", {
        id: row.id,
        field: "purchase_price",
      });
    } else {
      purchasePrice = parsed;
    }
  }

  return {
    brand: row.brand,
    condition,
    createdAt: row.created_at,
    creator: row.creator,
    description: row.description,
    id: asItemId(row.id),
    location: row.location,
    name: row.name,
    notes: row.notes,
    purchaseDate: row.purchase_date,
    purchasePrice,
    quantity: parseQuantity(row.quantity, row.id),
    type,
    updatedAt: row.updated_at,
    url: row.url,
  };
}
