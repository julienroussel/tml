/**
 * Supported locales and their regional variants:
 * - en: English (American)
 * - fr: French (France)
 * - es: Spanish (Spain / Peninsular)
 * - pt: Portuguese (Portugal / European)
 * - it: Italian
 * - de: German
 * - nl: Dutch (Netherlands)
 */
const locales = ["en", "fr", "es", "pt", "it", "de", "nl"] as const;
type Locale = (typeof locales)[number];
const defaultLocale: Locale = "en";

function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** Props for marketing pages that receive a locale URL segment. */
interface LocaleParams {
  params: Promise<{ locale: string }>;
}

export type { Locale, LocaleParams };
export { defaultLocale, isLocale, locales };
