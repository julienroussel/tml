import { getLocale, getMessages, getTranslations } from "next-intl/server";
import type { ReactElement, ReactNode } from "react";
import { Providers } from "@/components/providers";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";

// Auth pages are dynamic (not force-static) so the server can read the
// NEXT_LOCALE cookie and render the correct locale on the first frame.
// This avoids hydration mismatches when the user's preferred locale
// differs from the default.
export default async function AuthLayout({
  children,
}: Readonly<{ children: ReactNode }>): Promise<ReactElement> {
  const rawLocale = await getLocale();
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const [tCommon, messages] = await Promise.all([
    getTranslations({ locale, namespace: "common" }),
    getMessages({ locale }),
  ]);

  return (
    <Providers locale={locale} messages={messages}>
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:shadow-md"
        href="#main-content"
      >
        {tCommon("skipToContent")}
      </a>
      {children}
    </Providers>
  );
}
