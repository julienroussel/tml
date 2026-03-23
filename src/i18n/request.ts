import { cookies, headers } from "next/headers";
import type { AbstractIntlMessages } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, type Locale } from "./config";

/**
 * Parses the Accept-Language header and returns the best matching supported
 * locale, or undefined if no match is found.
 *
 * Handles formats like:
 * - "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7"
 * - "de"
 * - "pt-BR,pt;q=0.9"
 *
 * Matching strategy:
 * 1. Exact match (e.g., "fr" matches "fr")
 * 2. Base language match (e.g., "fr-FR" matches "fr", "pt-BR" matches "pt")
 * 3. First match wins (highest q-value comes first in the header)
 */
function negotiateLocale(acceptLanguage: string): Locale | undefined {
  // Parse and sort by q-value (already sorted by convention, but be safe)
  const entries = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const raw = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
      const q = Number.isNaN(raw) ? 0 : raw;
      return { tag: tag?.trim().toLowerCase() ?? "", q };
    })
    .filter((e) => e.tag.length > 0 && e.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of entries) {
    // Exact match: "fr" → "fr"
    if (isLocale(tag)) {
      return tag;
    }
    // Base language match: "fr-FR" → "fr"
    const base = tag.split("-")[0];
    if (base && isLocale(base)) {
      return base;
    }
  }

  return undefined;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;

  let locale: Locale;

  if (requested && isLocale(requested)) {
    // Explicit locale from next-intl routing or middleware
    locale = requested;
  } else {
    // next-intl's requestLocale is undefined when there's no i18n routing
    // middleware. Read the NEXT_LOCALE cookie directly as the primary source.
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;

    if (cookieLocale && isLocale(cookieLocale)) {
      locale = cookieLocale;
    } else {
      // No cookie — negotiate from browser's Accept-Language header.
      // This gives new users their device language automatically, before
      // they set a preference. Falls back to defaultLocale ("en").
      const headersList = await headers();
      const acceptLanguage = headersList.get("accept-language");
      locale = acceptLanguage
        ? (negotiateLocale(acceptLanguage) ?? defaultLocale)
        : defaultLocale;
    }
  }

  const imported: { default: AbstractIntlMessages } = await import(
    `./messages/${locale}.json`
  );

  return {
    locale,
    messages: imported.default,
  };
});

export { negotiateLocale };
