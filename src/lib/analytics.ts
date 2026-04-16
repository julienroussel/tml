import { track } from "@vercel/analytics";
import type { ItemType } from "@/features/collect/constants";
import type { Locale } from "@/i18n/config";

/**
 * All tracked event names and their expected properties.
 * Centralised here so every call site is type-checked.
 */
interface AnalyticsEventMap {
  item_created: { type: ItemType };
  item_deleted: Record<string, never>;
  item_updated: Record<string, never>;
  locale_changed: { locale: Locale };
  push_notifications_disabled: Record<string, never>;
  push_notifications_enabled: Record<string, never>;
  tag_created: Record<string, never>;
  theme_changed: { theme: "dark" | "light" };
  trick_created: { category: string | null; status: string };
  trick_deleted: Record<string, never>;
  trick_updated: Record<string, never>;
}

type EventName = keyof AnalyticsEventMap;

/**
 * Type-safe wrapper around Vercel Analytics `track()`.
 *
 * Usage:
 * ```ts
 * trackEvent("theme_changed", { theme: "dark" });
 * ```
 */
function trackEvent<E extends EventName>(
  ...args: AnalyticsEventMap[E] extends Record<string, never>
    ? [event: E]
    : [event: E, properties: AnalyticsEventMap[E]]
): void {
  const [event, properties] = args;
  if (properties) {
    track(event, properties);
  } else {
    track(event);
  }
}

export type { AnalyticsEventMap, EventName };
export { trackEvent };
