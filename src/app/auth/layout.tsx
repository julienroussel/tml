import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import type { ReactElement, ReactNode } from "react";
import { Providers } from "@/components/providers";
import { defaultLocale } from "@/i18n/config";

export const dynamic = "force-static";

// Auth pages are statically generated — locale detection requires cookies/headers
// which aren't available at build time. Default to English; the DynamicIntlProvider's
// useEffect will sync the correct locale on the client after hydration.
export default async function AuthLayout({
  children,
}: Readonly<{ children: ReactNode }>): Promise<ReactElement> {
  setRequestLocale(defaultLocale);
  const [tCommon, messages] = await Promise.all([
    getTranslations({ locale: defaultLocale, namespace: "common" }),
    getMessages({ locale: defaultLocale }),
  ]);

  return (
    <Providers locale={defaultLocale} messages={messages}>
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
