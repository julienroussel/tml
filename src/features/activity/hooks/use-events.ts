"use client";

import { useQuery } from "@powersync/react";
import { asItemId, asTagId, asTrickId, asUserId } from "@/db/types";
import type { EntityId } from "@/lib/events/types";
import type { EventRow, ParsedEvent } from "../types";

/**
 * Re-brand a raw `entity_id` string using the `entity_type` discriminator so a
 * tag-row id can't silently flow into a `TrickId` slot. Unknown entity types
 * drop the brand (return `null`) rather than widening the union.
 */
function brandEntityId(
  entityType: string | null,
  entityId: string | null
): EntityId | null {
  if (entityId === null) {
    return null;
  }
  switch (entityType) {
    case "trick":
      return asTrickId(entityId);
    case "tag":
      return asTagId(entityId);
    case "item":
      return asItemId(entityId);
    case "settings":
    case "auth":
    case "notifications":
      return asUserId(entityId);
    default:
      return null;
  }
}

interface UseEventsOptions {
  /** Filter to a single entity_type (e.g. `"trick"`, `"item"`). */
  entityType?: string;
  /** Filter to a single event_type (e.g. `"trick.created"`). */
  eventType?: string;
  /** Cap the number of rows returned. Defaults to 200. */
  limit?: number;
}

interface UseEventsResult {
  error: Error | null;
  events: ParsedEvent[];
  isLoading: boolean;
}

const DEFAULT_LIMIT = 200;

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_LIMIT;
  }
  return Math.max(1, Math.floor(value));
}

const warnedPayloadIds = new Set<string>();
const warnedMalformedRowIds = new Set<string>();

function parsePayload(raw: string, eventId: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch (error: unknown) {
    // Dedup like format-event.ts dedups warned types — tick of useNow re-renders
    // the feed every minute and we don't want to spam the console each tick.
    if (!warnedPayloadIds.has(eventId)) {
      warnedPayloadIds.add(eventId);
      console.warn("[activity] malformed event payload", {
        eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return {};
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Runtime guard for an `event_log` row coming back from local SQLite. Drops
 * rows missing the non-null fields the table is supposed to enforce — better
 * to skip a malformed row than to render an entry with empty id/type or
 * crash the feed.
 */
function isEventRow(value: unknown): value is EventRow {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as Record<string, unknown>;
  if (!isNonEmptyString(row.id)) {
    return false;
  }
  if (!isNonEmptyString(row.user_id)) {
    return false;
  }
  if (!isNonEmptyString(row.event_type)) {
    return false;
  }
  if (!isNonEmptyString(row.created_at)) {
    return false;
  }
  if (typeof row.payload !== "string") {
    return false;
  }
  if (row.source !== "client" && row.source !== "server") {
    return false;
  }
  return true;
}

function parseEventRow(row: EventRow): ParsedEvent | null {
  // Defensive: callers should pre-filter with `isEventRow`. If a malformed
  // row sneaks through (older callers, tests), warn once and drop it —
  // returning `null` lets callers `.flatMap` past it without rendering a
  // half-formed entry or crashing the feed.
  if (!(isNonEmptyString(row.id) && isNonEmptyString(row.event_type))) {
    const idKey = typeof row.id === "string" ? row.id : "<no-id>";
    if (!warnedMalformedRowIds.has(idKey)) {
      warnedMalformedRowIds.add(idKey);
      console.warn("[activity] malformed event row", {
        id: row.id,
        eventType: row.event_type,
      });
    }
    return null;
  }
  const source = row.source === "server" ? "server" : "client";
  // The branded ids land on the row as plain strings (PowerSync local
  // SQLite is unbranded). Re-brand at the boundary so downstream consumers
  // get the typed union back.
  return {
    id: row.id,
    userId: asUserId(row.user_id),
    eventType: row.event_type,
    entityType: row.entity_type,
    entityId: brandEntityId(row.entity_type, row.entity_id),
    payload: parsePayload(row.payload, row.id),
    source,
    createdAt: row.created_at,
  };
}

function buildEventsQuery(options: UseEventsOptions): {
  sql: string;
  params: unknown[];
} {
  const conditions: string[] = ["deleted_at IS NULL"];
  const params: unknown[] = [];

  if (options.eventType) {
    conditions.push("event_type = ?");
    params.push(options.eventType);
  }
  if (options.entityType) {
    conditions.push("entity_type = ?");
    params.push(options.entityType);
  }

  const limit = clampLimit(options.limit ?? DEFAULT_LIMIT);
  const sql = `SELECT * FROM event_log WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT ${limit}`;
  return { sql, params };
}

/**
 * Returns a reactive list of the user's events from local SQLite, ordered
 * newest-first. Re-runs automatically when the local `event_log` table
 * changes (inserts via `logEvent`, syncs from server-emitted events).
 */
function useEvents(options: UseEventsOptions = {}): UseEventsResult {
  const { sql, params } = buildEventsQuery(options);
  const { data, isLoading, error } = useQuery<EventRow>(sql, params);
  const events = data
    .filter((row): row is EventRow => {
      if (isEventRow(row)) {
        return true;
      }
      const id = (row as { id?: unknown })?.id;
      const idKey = typeof id === "string" ? id : "<no-id>";
      if (!warnedMalformedRowIds.has(idKey)) {
        warnedMalformedRowIds.add(idKey);
        console.warn("[activity] skipping malformed event row", { id: idKey });
      }
      return false;
    })
    .flatMap((row) => parseEventRow(row) ?? []);
  return {
    events,
    isLoading,
    error: error ?? null,
  };
}

export type { UseEventsOptions, UseEventsResult };
export { buildEventsQuery, isEventRow, parseEventRow, useEvents };
