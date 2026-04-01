"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactElement } from "react";
import { APP_MODULES } from "@/lib/modules";

type NavKey = Parameters<ReturnType<typeof useTranslations<"nav">>>[0];

const NAV_KEYS = [
  "dashboard",
  "repertoire",
  "settings",
  ...APP_MODULES.map((m) => m.slug),
] satisfies readonly NavKey[];

const NAV_KEY_SET = new Set<string>(NAV_KEYS);

function isNavKey(key: string): key is NavKey {
  return NAV_KEY_SET.has(key);
}

export function HeaderTitle(): ReactElement | null {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const segment = pathname.split("/")[1];

  if (!(segment && isNavKey(segment))) {
    return null;
  }

  return <span className="font-medium text-sm">{t(segment)}</span>;
}
