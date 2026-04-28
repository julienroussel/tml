import type { EventType } from "@/lib/events/types";
import type {
  ParsedEvent,
  ParsedKnownEvent,
  ParsedUnknownEvent,
} from "../types";

interface FormattedEvent {
  /** Fallback display string if i18n key is missing — never the primary path. */
  fallback: string;
  /** i18n key under `activity.events.*`, picked by event_type. */
  labelKey: string;
  /** Values passed to the i18n string for interpolation. */
  values: Record<string, string>;
}

function stringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

const warnedUnknownTypes = new Set<string>();

/**
 * Statically-derived list of every known `EventType`. Adding a new key to
 * `EventPayloadMap` in `@/lib/events/types` requires extending this record
 * (the `satisfies Record<EventType, true>` clause fails compilation
 * otherwise) which in turn forces a new `case` below.
 */
const KNOWN_EVENT_TYPES = {
  "auth.signed_up": true,
  "item.created": true,
  "item.deleted": true,
  "item.updated": true,
  "notifications.subscribed": true,
  "notifications.unsubscribed": true,
  "settings.locale_changed": true,
  "settings.theme_changed": true,
  "tag.created": true,
  "trick.created": true,
  "trick.deleted": true,
  "trick.updated": true,
} as const satisfies Record<EventType, true>;

function isKnownEventType(value: string): value is EventType {
  return Object.hasOwn(KNOWN_EVENT_TYPES, value);
}

function formatUnknown(event: ParsedUnknownEvent): FormattedEvent {
  // Internal event_type is not user-facing — log for observability and
  // render a generic label so renamed/removed events don't leak ids.
  // Dedup by event_type so the 60s useNow tick doesn't re-warn each render.
  if (!warnedUnknownTypes.has(event.eventType)) {
    warnedUnknownTypes.add(event.eventType);
    console.warn("Unknown event type in activity feed:", event.eventType);
  }
  return {
    labelKey: "activity.events.unknown",
    values: {},
    fallback: "Activity recorded",
  };
}

function formatKnown(event: ParsedKnownEvent): FormattedEvent {
  const name = stringField(event.payload, "name");

  switch (event.eventType) {
    case "trick.created":
      return {
        labelKey: "activity.events.trick_created",
        values: { name },
        fallback: `Created trick ${name}`,
      };
    case "trick.updated":
      return {
        labelKey: "activity.events.trick_updated",
        values: { name },
        fallback: `Updated trick ${name}`,
      };
    case "trick.deleted":
      return {
        labelKey: "activity.events.trick_deleted",
        values: { name },
        fallback: `Deleted trick ${name}`,
      };
    case "tag.created":
      return {
        labelKey: "activity.events.tag_created",
        values: { name },
        fallback: `Created tag ${name}`,
      };
    case "item.created":
      return {
        labelKey: "activity.events.item_created",
        values: { name },
        fallback: `Added item ${name} to your collection`,
      };
    case "item.updated":
      return {
        labelKey: "activity.events.item_updated",
        values: { name },
        fallback: `Updated item ${name}`,
      };
    case "item.deleted":
      return {
        labelKey: "activity.events.item_deleted",
        values: { name },
        fallback: `Deleted item ${name}`,
      };
    case "settings.theme_changed": {
      const theme = stringField(event.payload, "theme");
      return {
        labelKey: "activity.events.theme_changed",
        values: { theme },
        fallback: `Changed theme to ${theme}`,
      };
    }
    case "settings.locale_changed": {
      const locale = stringField(event.payload, "locale");
      return {
        labelKey: "activity.events.locale_changed",
        values: { locale },
        fallback: `Changed language to ${locale}`,
      };
    }
    case "notifications.subscribed":
      return {
        labelKey: "activity.events.notifications_subscribed",
        values: {},
        fallback: "Enabled notifications",
      };
    case "notifications.unsubscribed":
      return {
        labelKey: "activity.events.notifications_unsubscribed",
        values: {},
        fallback: "Disabled notifications",
      };
    case "auth.signed_up":
      return {
        labelKey: "activity.events.signed_up",
        values: {},
        fallback: "Joined The Magic Lab",
      };
    default: {
      // Exhaustiveness gate: if a new `EventType` is added to
      // `EventPayloadMap` without a corresponding case above, this branch
      // ceases to be `never` and TypeScript fails the assignment below.
      const _exhaustive: never = event;
      throw new Error(
        `Unhandled known event type: ${(_exhaustive as { eventType: string }).eventType}`
      );
    }
  }
}

/**
 * Turns a ParsedEvent into the i18n key and interpolation values needed to
 * render its activity-feed label. The caller looks up `labelKey` via
 * `useTranslations()` and passes `values` for variable substitution.
 *
 * If the event_type is unknown (e.g. an old type that's been removed),
 * returns a generic key so the UI doesn't crash.
 */
function formatEvent(event: ParsedEvent): FormattedEvent {
  if (!isKnownEventType(event.eventType)) {
    return formatUnknown(event as ParsedUnknownEvent);
  }
  return formatKnown(event as ParsedKnownEvent);
}

const ENTITY_ICON_KEY: Record<string, string> = {
  trick: "trick",
  tag: "tag",
  item: "item",
  settings: "settings",
  notifications: "notifications",
  auth: "auth",
};

/** Returns a stable key for picking the row icon based on entity_type. */
function getEntityIconKey(event: ParsedEvent): string {
  return ENTITY_ICON_KEY[event.entityType ?? ""] ?? "default";
}

/**
 * Test-only helper: clears the module-scoped dedup set used to suppress
 * repeat `console.warn` calls for unknown event types. Tests asserting on
 * the warn call should invoke this in `beforeEach` so test order doesn't
 * affect the assertion.
 */
function __resetWarnedTypesForTest(): void {
  warnedUnknownTypes.clear();
}

export type { FormattedEvent };
export {
  __resetWarnedTypesForTest,
  formatEvent,
  getEntityIconKey,
  isKnownEventType,
  KNOWN_EVENT_TYPES,
};
