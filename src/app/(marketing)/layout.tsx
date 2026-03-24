import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactElement, ReactNode } from "react";
import { Logo } from "@/components/logo";
import { MarketingAuthButtons } from "@/components/marketing-auth-buttons";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function MarketingLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): Promise<ReactElement> {
  const t = await getTranslations("footer");

  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6"
        >
          <Logo
            className="flex items-center gap-2"
            height={32}
            imageClassName="h-8 w-auto"
            width={96}
          />
          <div className="flex items-center gap-2">
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
            {t("copyright", { year: new Date().getFullYear() })}
          </p>
          <nav aria-label="Footer links" className="flex gap-4">
            <Link
              className="text-muted-foreground text-sm transition-colors hover:text-foreground"
              href="/privacy"
            >
              {t("privacy")}
            </Link>
            <Link
              className="text-muted-foreground text-sm transition-colors hover:text-foreground"
              href="/faq"
            >
              {t("faq")}
            </Link>
            <a
              className="text-muted-foreground text-sm transition-colors hover:text-foreground"
              href="https://memdeck.org"
              rel="noopener noreferrer"
              target="_blank"
            >
              {t("memDeck")}
              <span className="sr-only"> {t("memDeckSrOnly")}</span>
            </a>
            <a
              className="text-muted-foreground text-sm transition-colors hover:text-foreground"
              href="https://github.com/julienroussel/tml"
              rel="noopener noreferrer"
              target="_blank"
            >
              {t("gitHub")}
              <span className="sr-only"> {t("gitHubSrOnly")}</span>
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
