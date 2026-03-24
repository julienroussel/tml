import type { AbstractIntlMessages } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, type Locale } from "./config";
import { negotiateLocale } from "./negotiate";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;

  let locale: Locale;

  if (requested && isLocale(requested)) {
    // Explicit locale from next-intl routing or middleware (includes
    // setRequestLocale). No dynamic APIs needed — the locale is known.
    locale = requested;
  } else {
    // next-intl's requestLocale is undefined when there's no i18n routing
    // middleware and setRequestLocale wasn't called. This path is dynamic
    // (cookies/headers) so we lazy-import next/headers to keep the module
    // statically analysable for routes that DO call setRequestLocale.
    const { cookies, headers } = await import("next/headers");
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
    timeZone: "UTC",
  };
});
