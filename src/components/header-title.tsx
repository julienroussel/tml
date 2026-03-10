"use client";

import { usePathname } from "next/navigation";
import type { ReactElement } from "react";
import { APP_MODULES } from "@/lib/modules";

const STATIC_TITLES = {
  dashboard: "Dashboard",
  settings: "Settings",
} as const satisfies Record<string, string>;

function isStaticTitleKey(key: string): key is keyof typeof STATIC_TITLES {
  return key in STATIC_TITLES;
}

export function HeaderTitle(): ReactElement | null {
  const pathname = usePathname();
  const segment = pathname.split("/")[1];

  const staticTitle =
    segment !== undefined && isStaticTitleKey(segment)
      ? STATIC_TITLES[segment]
      : undefined;

  const label =
    staticTitle ?? APP_MODULES.find((m) => m.slug === segment)?.label;

  if (!label) {
    return null;
  }

  return <span className="font-medium text-sm">{label}</span>;
}
