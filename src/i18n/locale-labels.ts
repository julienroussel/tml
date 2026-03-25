import type { Locale } from "./config";

/** Locale autonyms — displayed in their own language so users can always find theirs. */
const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  pt: "Português",
  it: "Italiano",
  de: "Deutsch",
  nl: "Nederlands",
};

export { LOCALE_LABELS };
