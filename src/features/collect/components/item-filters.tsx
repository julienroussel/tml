"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CONDITION_CONFIG,
  type FilterSortValue,
  ITEM_CONDITIONS,
  ITEM_SORTS,
  ITEM_TYPES,
  type ItemCondition,
  type ItemType,
  isFilterSortValue,
  isItemCondition,
  isItemType,
  TYPE_CONFIG,
} from "../constants";

/** Sentinel value representing "all" (no filter). */
const ALL = "__all__";

const SORT_LABEL_KEYS: Record<FilterSortValue, string> = {
  newest: "sort.newest",
  oldest: "sort.oldest",
  "name-asc": "sort.nameAsc",
  "name-desc": "sort.nameDesc",
  "price-asc": "sort.priceAsc",
  "price-desc": "sort.priceDesc",
  "type-asc": "sort.type",
};

export interface ItemFiltersProps {
  condition: ItemCondition | null;
  onConditionChange: (value: ItemCondition | null) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: FilterSortValue) => void;
  onTypeChange: (value: ItemType | null) => void;
  search: string;
  sort: FilterSortValue;
  type: ItemType | null;
}

export function ItemFilters({
  search,
  onSearchChange,
  type,
  onTypeChange,
  condition,
  onConditionChange,
  sort,
  onSortChange,
}: ItemFiltersProps): React.ReactElement {
  const t = useTranslations("collect");

  function handleTypeChange(value: string): void {
    if (value === ALL) {
      onTypeChange(null);
      return;
    }
    if (isItemType(value)) {
      onTypeChange(value);
    }
  }

  function handleConditionChange(value: string): void {
    if (value === ALL) {
      onConditionChange(null);
      return;
    }
    if (isItemCondition(value)) {
      onConditionChange(value);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      {/* Search input */}
      <div className="relative w-full sm:flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-label={t("searchPlaceholder")}
          className="pl-9"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t("searchPlaceholder")}
          type="search"
          value={search}
        />
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Type filter */}
        <Select onValueChange={handleTypeChange} value={type ?? ALL}>
          <SelectTrigger
            aria-label={t("filterByType")}
            className="w-full min-w-[140px] sm:w-auto"
          >
            <SelectValue placeholder={t("allTypes")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allTypes")}</SelectItem>
            {ITEM_TYPES.map((itemType) => (
              <SelectItem key={itemType} value={itemType}>
                {t(TYPE_CONFIG[itemType].label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Condition filter */}
        <Select onValueChange={handleConditionChange} value={condition ?? ALL}>
          <SelectTrigger
            aria-label={t("filterByCondition")}
            className="w-full min-w-[140px] sm:w-auto"
          >
            <SelectValue placeholder={t("allConditions")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allConditions")}</SelectItem>
            {ITEM_CONDITIONS.map((cond) => (
              <SelectItem key={cond} value={cond}>
                {t(CONDITION_CONFIG[cond].label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select
          onValueChange={(value) => {
            if (isFilterSortValue(value)) {
              onSortChange(value);
            }
          }}
          value={sort}
        >
          <SelectTrigger
            aria-label={t("sortBy")}
            className="w-full min-w-[140px] sm:w-auto"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ITEM_SORTS.map((value) => (
              <SelectItem key={value} value={value}>
                {t(SORT_LABEL_KEYS[value])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
