import { isLocale } from "@/i18n/config";

/** One year in seconds. */
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const LOCALE_COOKIE_PATTERN = /(?:^|;\s*)NEXT_LOCALE=([^;]*)/;

/** Read the current `NEXT_LOCALE` cookie value, if present. */
export function getLocaleCookie(): string | undefined {
  const match = document.cookie.match(LOCALE_COOKIE_PATTERN);
  return match?.[1];
}

/** Set the `NEXT_LOCALE` cookie. No-op if `locale` is not a valid locale (defense-in-depth). */
export function setLocaleCookie(locale: string): void {
  if (!isLocale(locale)) {
    return;
  }

  const secure = location.protocol === "https:" ? ";secure" : "";

  // biome-ignore lint/suspicious/noDocumentCookie: document.cookie is the standard API for setting cookies client-side
  document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=${COOKIE_MAX_AGE};samesite=lax${secure}`;
}
