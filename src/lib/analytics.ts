import { track } from "@vercel/analytics";

/**
 * All tracked event names and their expected properties.
 * Centralised here so every call site is type-checked.
 */
interface AnalyticsEventMap {
  push_notifications_disabled: Record<string, never>;
  push_notifications_enabled: Record<string, never>;
  theme_changed: { theme: "dark" | "light" };
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
