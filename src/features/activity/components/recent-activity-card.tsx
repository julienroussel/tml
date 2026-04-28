"use client";

import { HistoryIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactElement } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEvents } from "../hooks/use-events";
import { ActivityList } from "./activity-list";

interface RecentActivityCardProps {
  /** How many recent events to show. Defaults to 5. */
  limit?: number;
}

const DEFAULT_LIMIT = 5;

function RecentActivityCard({
  limit = DEFAULT_LIMIT,
}: RecentActivityCardProps): ReactElement {
  const t = useTranslations("activity");
  const { events, isLoading, error } = useEvents({ limit });

  function renderBody(): ReactElement {
    if (error) {
      return (
        <p className="text-destructive text-sm" role="alert">
          {t("loadError")}
        </p>
      );
    }
    if (isLoading) {
      return (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      );
    }
    if (events.length === 0) {
      return <p className="text-muted-foreground text-sm">{t("emptyTitle")}</p>;
    }
    return <ActivityList events={events} />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 font-medium text-sm">
          <HistoryIcon className="size-4 text-muted-foreground" />
          {t("recentTitle")}
        </CardTitle>
        <Link
          className="-mx-2 inline-flex min-h-11 items-center px-2 text-muted-foreground text-xs underline-offset-4 hover:underline"
          href="/activity"
        >
          {t("viewAll")}
        </Link>
      </CardHeader>
      <CardContent>{renderBody()}</CardContent>
    </Card>
  );
}

export type { RecentActivityCardProps };
export { RecentActivityCard };
