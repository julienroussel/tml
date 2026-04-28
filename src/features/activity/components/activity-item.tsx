"use client";

import {
  BellIcon,
  HistoryIcon,
  LogInIcon,
  type LucideIcon,
  PackageIcon,
  SettingsIcon,
  TagIcon,
  WandSparklesIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import { formatEvent, getEntityIconKey } from "../lib/format-event";
import type { ParsedEvent } from "../types";

interface ActivityItemProps {
  className?: string;
  event: ParsedEvent;
  /**
   * Reference timestamp for the relative-time label. Defaults to the moment
   * the component renders; pass a ticking value (see `useNow`) so labels
   * refresh on quiet pages.
   */
  now?: number;
}

const ICON_MAP: Record<string, LucideIcon> = {
  trick: WandSparklesIcon,
  tag: TagIcon,
  item: PackageIcon,
  settings: SettingsIcon,
  notifications: BellIcon,
  auth: LogInIcon,
  default: HistoryIcon,
};

function ActivityItem({
  event,
  className,
  now,
}: ActivityItemProps): ReactElement {
  const t = useTranslations();
  const format = useFormatter();
  const formatted = formatEvent(event);
  const iconKey = getEntityIconKey(event);
  const Icon = ICON_MAP[iconKey] ?? ICON_MAP.default;
  // useNow() returns 0 before its mount effect runs; `??` would not fall back
  // because 0 is not nullish. Treat 0 as "not yet hydrated" per useNow's docs.
  const reference = now && now > 0 ? now : Date.now();

  return (
    <li
      className={cn(
        "flex min-h-11 items-start gap-3 rounded-md p-2 hover:bg-muted/50 motion-safe:transition-colors motion-safe:duration-150",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        {Icon ? <Icon className="size-4" /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm">
          {/* trim() handles the case where payload.name is empty (e.g.
              trick.deleted / item.deleted — name not snapshotted). The i18n
              string "Deleted trick {name}" becomes "Deleted trick " which we
              tidy to "Deleted trick". */}
          {t(formatted.labelKey, formatted.values).trim()}
        </p>
        <time
          className="mt-0.5 block text-muted-foreground text-xs"
          dateTime={event.createdAt}
        >
          {format.relativeTime(new Date(event.createdAt), reference)}
        </time>
      </div>
    </li>
  );
}

export type { ActivityItemProps };
export { ActivityItem };
