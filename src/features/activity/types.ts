import type { UserId } from "@/db/types";
import type {
  EntityId,
  EventPayload,
  EventSource,
  EventType,
} from "@/lib/events/types";

/**
 * Row shape as it appears in local SQLite (PowerSync client schema).
 * `payload` is a JSON string here — call JSON.parse to get the object.
 */
interface EventRow {
  created_at: string;
  deleted_at: string | null;
  entity_id: string | null;
  entity_type: string | null;
  event_type: string;
  id: string;
  payload: string;
  source: string;
  updated_at: string;
  user_id: string;
}

interface ParsedEventCommon {
  createdAt: string;
  entityId: EntityId | null;
  entityType: string | null;
  id: string;
  source: EventSource;
  userId: UserId;
}

/**
 * A parsed event whose `eventType` is a member of the known taxonomy. The
 * payload is narrowed to the matching `EventPayload<K>` so consumers get
 * full type-safety after a runtime guard confirms membership.
 */
type ParsedKnownEvent = {
  [K in EventType]: ParsedEventCommon & {
    eventType: K;
    payload: EventPayload<K>;
  };
}[EventType];

/**
 * A parsed event whose `eventType` did not match the known taxonomy — for
 * example a row written by an older client / future schema version. The
 * payload stays an opaque object so renderers can show a generic fallback.
 */
interface ParsedUnknownEvent extends ParsedEventCommon {
  eventType: string;
  payload: Record<string, unknown>;
}

/** Discriminated union — narrow with a runtime guard on `eventType`. */
type ParsedEvent = ParsedKnownEvent | ParsedUnknownEvent;

export type { EventRow, ParsedEvent, ParsedKnownEvent, ParsedUnknownEvent };
