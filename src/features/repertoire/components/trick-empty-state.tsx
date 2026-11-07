"use client";

import { WandSparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface TrickEmptyStateProps {
  onAddTrick: () => void;
}

export function TrickEmptyState({
  onAddTrick,
}: TrickEmptyStateProps): React.ReactElement {
  const t = useTranslations("repertoire");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <div className="bg-muted flex size-16 items-center justify-center rounded-2xl">
        <WandSparkles className="text-muted-foreground size-8" />
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          {t("emptyTitle")}
        </h2>
        <p className="text-muted-foreground max-w-md">
          {t("emptyDescription")}
        </p>
      </div>
      <Button onClick={onAddTrick}>{t("addTrick")}</Button>
    </div>
  );
}
