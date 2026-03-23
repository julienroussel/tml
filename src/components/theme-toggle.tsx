"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { type ReactElement, useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics";

export function ThemeToggle(): ReactElement {
  const t = useTranslations("common");
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div aria-hidden="true" className="size-11" />;
  }

  return (
    <button
      aria-label={t("toggleTheme")}
      className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
      onClick={() => {
        const next = resolvedTheme === "dark" ? "light" : "dark";
        // Ephemeral toggle — only changes the visual theme for this session.
        // Durable preference changes go through the Settings page's ThemeSelector,
        // which preserves "system" as a valid option.
        setTheme(next);
        trackEvent("theme_changed", { theme: next });
      }}
      type="button"
    >
      {resolvedTheme === "dark" ? (
        <Sun className="size-5" />
      ) : (
        <Moon className="size-5" />
      )}
    </button>
  );
}
