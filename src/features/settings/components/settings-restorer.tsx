"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { type ReactElement, useEffect } from "react";
import { updateLocale, updateTheme } from "@/app/(app)/settings/actions";
import {
  getLocaleCookie,
  setLocaleCookie,
} from "@/features/settings/locale-cookie";
import { isLocale, type Locale } from "@/i18n/config";
import { isTheme, type Theme } from "@/lib/theme";

/** Sync locale between cookie and DB. Returns true if a page refresh is needed. */
function syncLocale(dbLocale: Locale): boolean {
  const cookieLocale = getLocaleCookie();

  if (!cookieLocale) {
    // No cookie yet — restore from DB (new device login).
    // Always set the cookie so header negotiation doesn't override the user's explicit choice.
    setLocaleCookie(dbLocale);
    // Always refresh: the server may have negotiated a different locale via
    // Accept-Language (e.g., user chose "en" but browser sends "fr"). The
    // cookie won't take effect until the next request.
    return true;
  }

  if (isLocale(cookieLocale) && cookieLocale !== dbLocale) {
    // Cookie differs from DB — offline change that hasn't synced yet
    updateLocale(cookieLocale).catch(() => {
      // Still offline — will retry on next mount
    });
  }

  return false;
}

/** Sync theme between localStorage/next-themes and DB. */
function syncTheme(dbTheme: Theme, setTheme: (theme: string) => void): void {
  const storedTheme = localStorage.getItem("theme");

  if (!storedTheme || storedTheme === "system") {
    if (dbTheme !== "system") {
      setTheme(dbTheme);
    }
    return;
  }

  if (isTheme(storedTheme) && storedTheme !== dbTheme) {
    updateTheme(storedTheme).catch(() => {
      // Still offline — will retry on next mount
    });
  }
}

interface SettingsRestorerProps {
  dbLocale: Locale;
  dbTheme: Theme;
}

/**
 * Headless client component that bidirectionally syncs locale and theme
 * between client-side storage (cookie / next-themes) and the database.
 *
 * Handles two scenarios for each setting:
 *
 * 1. **New device login** (no local value, DB has non-default):
 *    Restores from DB → local storage.
 *
 * 2. **Offline change** (local value differs from DB):
 *    The user changed the setting while offline and the server action failed.
 *    Syncs local → DB so the preference persists across devices.
 *
 * Runs once on mount — after that, LocaleSelector / ThemeSelector manage changes.
 */
export function SettingsRestorer({
  dbLocale,
  dbTheme,
}: SettingsRestorerProps): ReactElement | null {
  const router = useRouter();
  const { setTheme } = useTheme();

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once on mount — props are stable from server render, setTheme is stable from next-themes
  useEffect(() => {
    const needsRefresh = syncLocale(dbLocale);
    syncTheme(dbTheme, setTheme);

    if (needsRefresh) {
      router.refresh();
    }
  }, []);

  return null;
}
