"use client";

import { Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactElement, useState } from "react";
import { updateLocale } from "@/app/(app)/settings/actions";
import { setLocaleCookie } from "@/features/settings/locale-cookie";
import { useLocaleSwitch } from "@/i18n/client-provider";
import { isLocale, type Locale, locales } from "@/i18n/config";
import { LOCALE_LABELS } from "@/i18n/locale-labels";

interface LocaleSelectorProps {
  currentLocale: Locale;
}

export function LocaleSelector({
  currentLocale,
}: LocaleSelectorProps): ReactElement {
  const t = useTranslations("settings");
  const { switchLocale } = useLocaleSwitch();
  const [selected, setSelected] = useState<Locale>(currentLocale);

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>): void {
    const value = event.target.value;
    if (!isLocale(value)) {
      return;
    }
    const newLocale = value;

    // Update local state immediately for responsive UI
    setSelected(newLocale);

    // 1. Set the cookie — persists the preference for the next server render
    setLocaleCookie(newLocale);

    // 2. Switch messages client-side — instant, works fully offline.
    //    All 7 locale files are bundled in the client at build time.
    switchLocale(newLocale);

    // 3. Persist to DB (fire-and-forget). If offline, SettingsRestorer
    //    will sync cookie→DB on the next online page load.
    updateLocale(newLocale).catch(() => {
      // Intentionally silent — cookie is the local source of truth.
    });
  }

  return (
    <div className="flex items-start gap-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted">
        <Globe className="size-5 text-muted-foreground" />
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <label className="font-medium text-sm" htmlFor="locale-select">
          {t("language")}
        </label>
        <p className="text-muted-foreground text-sm">
          {t("languageDescription")}
        </p>
        <select
          className="mt-1 w-full max-w-xs rounded-md border bg-background px-3 py-2 text-sm shadow-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          id="locale-select"
          onChange={handleChange}
          value={selected}
        >
          {locales.map((code) => (
            <option key={code} value={code}>
              {LOCALE_LABELS[code]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
