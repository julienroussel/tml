"use client";

import { HistoryIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactElement } from "react";

function ActivityEmptyState(): ReactElement {
  const t = useTranslations("activity");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
      <div
        aria-hidden="true"
        className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-2xl"
      >
        <HistoryIcon className="size-6" />
      </div>
      <h2 className="text-lg font-semibold">{t("emptyTitle")}</h2>
      <p className="text-muted-foreground max-w-sm text-sm">
        {t("emptyDescription")}
      </p>
    </div>
  );
}

export { ActivityEmptyState };
