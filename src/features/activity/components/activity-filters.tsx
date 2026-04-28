"use client";

import { useTranslations } from "next-intl";
import type { ReactElement } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Entity values surfaced in the dropdown. Must match the keys under
// `activity.filters.entity.*` in every locale file. Adding `notifications`
// or `auth` here without translations would surface raw keys to users.
const ENTITY_VALUES = ["trick", "tag", "item", "settings"] as const;

type EntityFilter = "all" | (typeof ENTITY_VALUES)[number];

const FILTER_VALUES: readonly EntityFilter[] = [
  "all",
  ...ENTITY_VALUES,
] as const;

interface ActivityFiltersProps {
  entity: EntityFilter;
  onEntityChange: (value: EntityFilter) => void;
}

function isEntityFilter(value: string): value is EntityFilter {
  return (FILTER_VALUES as readonly string[]).includes(value);
}

function ActivityFilters({
  entity,
  onEntityChange,
}: ActivityFiltersProps): ReactElement {
  const t = useTranslations("activity.filters");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label
        className="text-muted-foreground text-sm"
        htmlFor="activity-entity"
      >
        {t("label")}
      </label>
      <Select
        onValueChange={(value) => {
          if (isEntityFilter(value)) {
            onEntityChange(value);
          }
        }}
        value={entity}
      >
        <SelectTrigger className="min-h-11 w-44" id="activity-entity">
          <SelectValue placeholder={t("placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {FILTER_VALUES.map((value) => (
            <SelectItem key={value} value={value}>
              {t(`entity.${value}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export type { ActivityFiltersProps, EntityFilter };
export { ActivityFilters };
