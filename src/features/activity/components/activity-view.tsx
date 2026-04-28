"use client";

import { useTranslations } from "next-intl";
import { type ReactElement, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEvents } from "../hooks/use-events";
import { ActivityEmptyState } from "./activity-empty-state";
import { ActivityFilters, type EntityFilter } from "./activity-filters";
import { ActivityList } from "./activity-list";

function ActivityView(): ReactElement {
  const t = useTranslations("activity");
  const [entity, setEntity] = useState<EntityFilter>("all");
  const { events, isLoading, error } = useEvents({
    entityType: entity === "all" ? undefined : entity,
  });

  function renderBody(): ReactElement {
    if (isLoading) {
      return (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      );
    }
    if (events.length === 0) {
      return <ActivityEmptyState />;
    }
    return <ActivityList events={events} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </header>
      <ActivityFilters entity={entity} onEntityChange={setEntity} />
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {t("loadError")}
        </p>
      ) : null}
      {renderBody()}
    </div>
  );
}

export { ActivityView };
