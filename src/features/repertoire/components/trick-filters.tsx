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
import { STATUS_CONFIG, TRICK_STATUSES } from "../constants";

/** Sentinel value representing "all" (no filter). */
const ALL = "__all__";

interface TrickFiltersProps {
  categories: string[];
  category: string | null;
  onCategoryChange: (value: string | null) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onStatusChange: (value: string | null) => void;
  search: string;
  sort: string;
  status: string | null;
}

export function TrickFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  category,
  onCategoryChange,
  sort,
  onSortChange,
  categories,
}: TrickFiltersProps): React.ReactElement {
  const t = useTranslations("repertoire");

  function handleStatusChange(value: string): void {
    onStatusChange(value === ALL ? null : value);
  }

  function handleCategoryChange(value: string): void {
    onCategoryChange(value === ALL ? null : value);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      {/* Search input */}
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
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
        {/* Status filter */}
        <Select onValueChange={handleStatusChange} value={status ?? ALL}>
          <SelectTrigger
            aria-label={t("filterByStatus")}
            className="w-full min-w-[140px] sm:w-auto"
          >
            <SelectValue placeholder={t("allStatuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allStatuses")}</SelectItem>
            {TRICK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(STATUS_CONFIG[s].label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category filter */}
        <Select onValueChange={handleCategoryChange} value={category ?? ALL}>
          <SelectTrigger
            aria-label={t("filterByCategory")}
            className="w-full min-w-[140px] sm:w-auto"
          >
            <SelectValue placeholder={t("allCategories")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allCategories")}</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select onValueChange={onSortChange} value={sort}>
          <SelectTrigger
            aria-label={t("sortBy")}
            className="w-full min-w-[140px] sm:w-auto"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">{t("sort.nameAsc")}</SelectItem>
            <SelectItem value="name-desc">{t("sort.nameDesc")}</SelectItem>
            <SelectItem value="newest">{t("sort.newest")}</SelectItem>
            <SelectItem value="oldest">{t("sort.oldest")}</SelectItem>
            <SelectItem value="difficulty">{t("sort.difficulty")}</SelectItem>
            <SelectItem value="status">{t("sort.status")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
