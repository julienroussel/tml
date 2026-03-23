"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { type ReactElement, useEffect, useState } from "react";
import { updateTheme } from "@/app/(app)/settings/actions";
import { trackEvent } from "@/lib/analytics";
import type { Theme } from "@/lib/theme";

const THEME_OPTIONS: { icon: typeof Sun; value: Theme }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
];

interface ThemeSelectorProps {
  currentTheme: Theme;
}

export function ThemeSelector({
  currentTheme,
}: ThemeSelectorProps): ReactElement {
  const t = useTranslations("settings");
  const { setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<Theme>(currentTheme);

  useEffect(() => {
    setMounted(true);
  }, []);

  function handleSelect(theme: Theme): void {
    setSelected(theme);
    // Immediate visual feedback via next-themes
    setTheme(theme);
    let analyticsTheme: "light" | "dark";
    if (theme === "system") {
      analyticsTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    } else if (theme === "dark") {
      analyticsTheme = "dark";
    } else {
      analyticsTheme = "light";
    }
    trackEvent("theme_changed", { theme: analyticsTheme });

    // Persist to DB (fire-and-forget). If offline, this silently fails.
    // SettingsRestorer will sync localStorage→DB on the next online page load.
    updateTheme(theme).catch(() => {
      // Intentionally silent — visual feedback is instant via next-themes.
    });
  }

  const themeLabels: Record<Theme, string> = {
    light: t("themeLight"),
    dark: t("themeDark"),
    system: t("themeSystem"),
  };

  if (!mounted) {
    return <div aria-hidden="true" className="h-24" />;
  }

  return (
    <div className="flex items-start gap-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted">
        <Sun className="size-5 text-muted-foreground" />
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <p className="font-medium text-sm" id="theme-group-label">
          {t("theme")}
        </p>
        <p className="text-muted-foreground text-sm">{t("themeDescription")}</p>
        <div
          aria-labelledby="theme-group-label"
          className="mt-1 flex gap-2"
          role="radiogroup"
        >
          {THEME_OPTIONS.map(({ value, icon: Icon }) => (
            <label
              className={`inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors focus-within:outline-2 focus-within:outline-ring focus-within:outline-offset-2 ${
                selected === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
              key={value}
            >
              <input
                checked={selected === value}
                className="sr-only"
                name="theme"
                onChange={() => handleSelect(value)}
                type="radio"
                value={value}
              />
              <Icon className="size-4" />
              {themeLabels[value]}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
