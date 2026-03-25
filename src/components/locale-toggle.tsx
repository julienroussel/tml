"use client";

import { Globe } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { ReactElement } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setLocaleCookie } from "@/features/settings/locale-cookie";
import { useLocaleSwitch } from "@/i18n/client-provider";
import { isLocale, type Locale, locales } from "@/i18n/config";
import { LOCALE_LABELS } from "@/i18n/locale-labels";
import { trackEvent } from "@/lib/analytics";

/**
 * Check if the current path is a marketing page with a locale URL segment.
 * Marketing pages have paths like `/en`, `/fr/faq`, `/es/privacy`.
 * Returns the locale segment if found, otherwise null.
 */
function extractPathLocale(pathname: string): Locale | null {
  const firstSegment = pathname.split("/")[1];
  if (firstSegment && isLocale(firstSegment)) {
    return firstSegment;
  }
  return null;
}

export function LocaleToggle(): ReactElement {
  const t = useTranslations("common");
  const locale = useLocale();
  const { switchLocale } = useLocaleSwitch();
  const pathname = usePathname();
  const router = useRouter();
  function handleLocaleChange(value: string): void {
    if (!isLocale(value)) {
      return;
    }

    if (value === locale) {
      return;
    }

    // 1. Persist cookie for the next server render
    setLocaleCookie(value);

    // 2. Switch messages client-side — instant, works fully offline
    switchLocale(value);

    // 3. Track the change
    trackEvent("locale_changed", { locale: value });

    // 4. On marketing pages the locale is in the URL (e.g. /en/faq).
    //    Navigate to the equivalent page with the new locale prefix.
    const pathLocale = extractPathLocale(pathname);
    if (pathLocale) {
      const newPath = pathname.replace(`/${pathLocale}`, `/${value}`);
      router.push(newPath);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={t("changeLanguage")}
          className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          type="button"
        >
          <Globe className="size-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          onValueChange={handleLocaleChange}
          value={locale}
        >
          {locales.map((code) => (
            <DropdownMenuRadioItem className="min-h-11" key={code} value={code}>
              <span lang={code}>{LOCALE_LABELS[code]}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
