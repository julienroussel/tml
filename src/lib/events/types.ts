import type { ItemId, TagId, TrickId, UserId } from "@/db/types";
import type { ItemType } from "@/features/collect/constants";
import type { Locale } from "@/i18n/config";

type EmptyPayload = Record<string, never>;

interface EventPayloadMap {
  "auth.signed_up": EmptyPayload;

  "item.created": { name: string; type: ItemType };
  "item.deleted": { name: string };
  "item.updated": { name: string };

  "notifications.subscribed": EmptyPayload;
  "notifications.unsubscribed": EmptyPayload;
  "settings.locale_changed": { locale: Locale };

  "settings.theme_changed": { theme: "dark" | "light" };

  "tag.created": { name: string };
  "trick.created": {
    name: string;
    status: string;
    category: string | null;
  };
  "trick.deleted": { name: string };
  "trick.updated": { name: string };
}

type EventType = keyof EventPayloadMap;
type EventPayload<T extends EventType> = EventPayloadMap[T];
type EventSource = "client" | "server";

/**
 * Union of branded entity ids that may appear as `entity_id` in the event log.
 * Includes `UserId` because settings/auth events use the user's id as the
 * entity id. Stays a string at runtime — the brand only narrows at compile
 * time so call sites cannot mix entity kinds.
 */
type EntityId = TrickId | TagId | ItemId | UserId;

const EVENT_LOG_COLUMNS = [
  "id",
  "user_id",
  "event_type",
  "entity_type",
  "entity_id",
  "payload",
  "source",
  "created_at",
  "updated_at",
] as const;

const EVENT_LOG_INSERT_SQL = `
  INSERT INTO event_log (${EVENT_LOG_COLUMNS.join(", ")})
  VALUES (${EVENT_LOG_COLUMNS.map(() => "?").join(", ")})
`;

/**
 * Explicit positional contract for the prepared `EVENT_LOG_INSERT_SQL`
 * statement. The tuple arity is statically asserted against
 * `EVENT_LOG_COLUMNS.length` below — drift in either definition fails
 * compilation rather than the SQL driver.
 */
type EventLogInsertParams = readonly [
  id: string,
  userId: UserId,
  eventType: EventType,
  entityType: string | null,
  entityId: EntityId | null,
  payloadJson: string,
  source: EventSource,
  createdAt: string,
  updatedAt: string,
];

// Type-level assertion: tuple arity must match the column-name array length.
// If either drifts, the conditional resolves to `never` and the satisfies
// assertion below fails compilation.
type AssertEventLogArity =
  EventLogInsertParams["length"] extends (typeof EVENT_LOG_COLUMNS)["length"]
    ? (typeof EVENT_LOG_COLUMNS)["length"] extends EventLogInsertParams["length"]
      ? true
      : never
    : never;
/**
 * Exported so the type-level arity check is treated as "used" and any drift
 * between `EventLogInsertParams` and `EVENT_LOG_COLUMNS` fails compilation
 * here rather than at the SQL driver.
 */
const EVENT_LOG_ARITY_OK: AssertEventLogArity = true;

export type {
  EntityId,
  EventLogInsertParams,
  EventPayload,
  EventPayloadMap,
  EventSource,
  EventType,
};
export { EVENT_LOG_ARITY_OK, EVENT_LOG_COLUMNS, EVENT_LOG_INSERT_SQL };
