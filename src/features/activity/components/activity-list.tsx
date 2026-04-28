"use client";

import { useTranslations } from "next-intl";
import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import { useNow } from "../hooks/use-now";
import type { ParsedEvent } from "../types";
import { ActivityItem } from "./activity-item";

interface ActivityListProps {
  className?: string;
  events: ParsedEvent[];
}

function ActivityList({ events, className }: ActivityListProps): ReactElement {
  const now = useNow();
  const t = useTranslations("activity");
  return (
    <ol
      aria-label={t("timelineLabel")}
      className={cn("flex flex-col gap-1", className)}
    >
      {events.map((event) => (
        <ActivityItem event={event} key={event.id} now={now} />
      ))}
    </ol>
  );
}

export type { ActivityListProps };
export { ActivityList };
