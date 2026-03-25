import Link from "next/link";
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import type { ReactElement, ReactNode } from "react";
import { LocaleToggle } from "@/components/locale-toggle";
import { Logo } from "@/components/logo";
import { MarketingAuthButtons } from "@/components/marketing-auth-buttons";
import { Providers } from "@/components/providers";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  defaultLocale,
  isLocale,
  type Locale,
  type LocaleParams,
  locales,
} from "@/i18n/config";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams(): { locale: string }[] {
  return locales.map((locale) => ({ locale }));
}

export default async function MarketingLayout({
  children,
  params,
}: Readonly<LocaleParams & { children: ReactNode }>): Promise<ReactElement> {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  setRequestLocale(locale);

  const [tCommon, tFooter, messages] = await Promise.all([
    getTranslations({ locale, namespace: "common" }),
    getTranslations({ locale, namespace: "footer" }),
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
      {/* lang={locale} provides correct language context for this subtree.
          The root <html lang="en"> is a trade-off for static generation —
          the DynamicIntlProvider's useEffect syncs the correct lang on hydration
          for app routes. Marketing pages use this div-level override instead. */}
      <div className="relative flex min-h-screen flex-col" lang={locale}>
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <nav
            aria-label={tCommon("mainNavigation")}
            className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6"
          >
            <Logo
              className="flex items-center gap-2"
              height={32}
              href={`/${locale}`}
              imageClassName="h-8 w-auto"
              width={96}
            />
            <div className="flex items-center gap-2">
              <LocaleToggle />
              <ThemeToggle />
              <MarketingAuthButtons />
            </div>
          </nav>
        </header>
        <main className="flex flex-1 flex-col" id="main-content">
          {children}
        </main>
        <footer className="border-t px-6 py-8">
          <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-sm">
              {tFooter("copyright", { year: new Date().getFullYear() })}
            </p>
            <nav aria-label={tCommon("footerLinks")} className="flex gap-4">
              <Link
                className="text-muted-foreground text-sm transition-colors hover:text-foreground"
                href={`/${locale}/privacy`}
              >
                {tFooter("privacy")}
              </Link>
              <Link
                className="text-muted-foreground text-sm transition-colors hover:text-foreground"
                href={`/${locale}/faq`}
              >
                {tFooter("faq")}
              </Link>
              <a
                className="text-muted-foreground text-sm transition-colors hover:text-foreground"
                href="https://memdeck.org"
                rel="noopener noreferrer"
                target="_blank"
              >
                {tFooter("memDeck")}
                <span className="sr-only"> {tFooter("memDeckSrOnly")}</span>
              </a>
              <a
                className="text-muted-foreground text-sm transition-colors hover:text-foreground"
                href="https://github.com/julienroussel/tml"
                rel="noopener noreferrer"
                target="_blank"
              >
                {tFooter("gitHub")}
                <span className="sr-only"> {tFooter("gitHubSrOnly")}</span>
              </a>
            </nav>
          </div>
        </footer>
      </div>
    </Providers>
  );
}
