import type { AbstractIntlMessages } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, type Locale, locales } from "./config";

const isLocale = (value: string): value is Locale =>
  (locales as readonly string[]).includes(value);

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : defaultLocale;

  const imported: { default: AbstractIntlMessages } = await import(
    `./messages/${locale}.json`
  );

  return {
    locale,
    messages: imported.default,
  };
});
