import type { Locale } from "@/i18n/config";
import { isLocale } from "@/i18n/config";
import type { Theme } from "@/lib/theme";
import { isTheme } from "@/lib/theme";

/** Cookie name for the user-synced sentinel. */
export const USER_SYNCED_COOKIE = "user-synced";

/** Seven days in seconds. */
export const USER_SYNCED_MAX_AGE = 60 * 60 * 24 * 7;

/** Delimiter used in the cookie value. */
const COOKIE_DELIMITER = "|";

/** UUID v4 format (case-insensitive) — defense-in-depth for cookie parsing. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Builds the cookie value string for the user-synced sentinel. */
export function buildSyncCookieValue(
  userId: string,
  locale: Locale,
  theme: Theme
): string {
  return [userId, locale, theme].join(COOKIE_DELIMITER);
}

/**
 * Parses the user-synced cookie value into its components.
 * Returns null if the value is malformed or contains invalid locale/theme.
 */
export function parseSyncCookie(
  value: string
): { userId: string; locale: Locale; theme: Theme } | null {
  const parts = value.split(COOKIE_DELIMITER);
  if (parts.length !== 3) {
    return null;
  }

  const [userId, rawLocale, rawTheme] = parts;
  if (!(userId && rawLocale && rawTheme && UUID_RE.test(userId))) {
    return null;
  }

  if (!(isLocale(rawLocale) && isTheme(rawTheme))) {
    return null;
  }

  return { userId, locale: rawLocale, theme: rawTheme };
}
