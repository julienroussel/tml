/**
 * Parsed types for collection data read from local SQLite via PowerSync.
 *
 * These mirror the server-side Drizzle schema but use camelCase field names
 * and native JS types (numbers instead of text for price, etc.).
 */

import type { ItemId, TrickId } from "@/db/types";
import type { ParsedTag } from "@/features/repertoire/types";
import type { ItemCondition, ItemType } from "./constants";

export interface LinkedItem {
  id: ItemId;
  name: string;
  type: ItemType;
}

export interface ParsedItem {
  brand: string | null;
  condition: ItemCondition | null;
  createdAt: string;
  creator: string | null;
  description: string | null;
  id: ItemId;
  location: string | null;
  name: string;
  notes: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  quantity: number;
  type: ItemType;
  updatedAt: string;
  url: string | null;
}

export interface LinkedTrick {
  id: TrickId;
  name: string;
}

export interface ItemWithRelations extends ParsedItem {
  tags: ParsedTag[];
  tricks: LinkedTrick[];
}
