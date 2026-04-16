"use client";

import { Package } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface ItemEmptyStateProps {
  onAddItem: () => void;
}

export function ItemEmptyState({
  onAddItem,
}: ItemEmptyStateProps): React.ReactElement {
  const t = useTranslations("collect");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <Package aria-hidden="true" className="size-8 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="font-semibold text-2xl tracking-tight">
          {t("emptyTitle")}
        </h2>
        <p className="max-w-md text-muted-foreground">
          {t("emptyDescription")}
        </p>
      </div>
      <Button onClick={onAddItem}>{t("addItem")}</Button>
    </div>
  );
}
