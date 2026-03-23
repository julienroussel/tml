import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactElement } from "react";
import { getUserSettings } from "@/app/(app)/settings/actions";
import { LocaleSelector } from "@/features/settings/components/locale-selector";
import { ThemeSelector } from "@/features/settings/components/theme-selector";
import { defaultLocale, isLocale } from "@/i18n/config";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your account and preferences.",
};

export default async function SettingsPage(): Promise<ReactElement> {
  const [t, settings, rawLocale] = await Promise.all([
    getTranslations("settings"),
    getUserSettings(),
    getLocale(),
  ]);

  // Use the active rendered locale (from cookie/negotiation) for the selector,
  // not the DB value — the DB may lag behind after offline changes.
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const theme = settings?.theme ?? "system";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("description")}</p>
      </div>
      <div className="space-y-6">
        <LocaleSelector currentLocale={locale} />
        <ThemeSelector currentTheme={theme} />
      </div>
    </div>
  );
}
