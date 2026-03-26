"use client";

import { Clock, Edit, MoreHorizontal, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TrickId } from "@/db/types";
import { cn } from "@/lib/utils";
import type { ParsedTag, TrickWithTags } from "../types";
import { TrickDifficulty } from "./trick-difficulty";
import { TrickStatusBadge } from "./trick-status-badge";

interface TrickCardProps {
  onDelete: (id: TrickId) => void;
  onEdit: (id: TrickId) => void;
  trick: TrickWithTags;
}

/** Format a duration in seconds as "Xm Ys". */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  if (minutes > 0 && remaining > 0) {
    return `${String(minutes)}m ${String(remaining)}s`;
  }
  if (minutes > 0) {
    return `${String(minutes)}m`;
  }
  return `${String(remaining)}s`;
}

const MAX_VISIBLE_TAGS = 3;

export function TrickCard({
  trick,
  onEdit,
  onDelete,
}: TrickCardProps): React.ReactElement {
  const t = useTranslations("repertoire");

  function handleCardClick(): void {
    onEdit(trick.id);
  }

  function handleCardKeyDown(event: React.KeyboardEvent): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onEdit(trick.id);
    }
  }

  function handleMenuTriggerClick(event: React.MouseEvent): void {
    event.stopPropagation();
  }

  function handleMenuTriggerKeyDown(event: React.KeyboardEvent): void {
    event.stopPropagation();
  }

  const visibleTags = trick.tags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenTagCount = trick.tags.length - MAX_VISIBLE_TAGS;

  return (
    <Card
      aria-label={`${t("edit")}: ${trick.name}`}
      className={cn(
        "cursor-pointer hover:border-ring motion-safe:transition-colors"
      )}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      role="button"
      tabIndex={0}
    >
      <CardHeader className="relative">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold">{trick.name}</h3>
            {trick.description ? (
              <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
                {trick.description}
              </p>
            ) : null}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={t("cardActions")}
                className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:transition-colors"
                onClick={handleMenuTriggerClick}
                onKeyDown={handleMenuTriggerKeyDown}
                type="button"
              >
                <MoreHorizontal className="size-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(trick.id);
                }}
              >
                <Edit />
                {t("edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(trick.id);
                }}
                variant="destructive"
              >
                <Trash2 />
                {t("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {/* Category and effect type badges */}
        {(trick.category || trick.effectType) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {trick.category ? (
              <Badge variant="secondary">{trick.category}</Badge>
            ) : null}
            {trick.effectType ? (
              <Badge variant="outline">{trick.effectType}</Badge>
            ) : null}
          </div>
        )}

        {/* Duration */}
        {trick.duration !== null && trick.duration > 0 && (
          <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
            <Clock aria-hidden="true" className="size-3.5" />
            <span>
              <span className="sr-only">{t("field.duration")}: </span>
              {formatDuration(trick.duration)}
            </span>
          </div>
        )}

        {/* Difficulty */}
        {trick.difficulty !== null && (
          <TrickDifficulty readOnly size="sm" value={trick.difficulty} />
        )}

        {/* Status */}
        <div>
          <TrickStatusBadge status={trick.status} />
        </div>

        {/* Tags */}
        {trick.tags.length > 0 && (
          <ul
            aria-label={t("field.tags")}
            className="flex flex-wrap items-center gap-1.5"
          >
            {visibleTags.map((tag) => (
              <li key={tag.id}>
                <TagBadge tag={tag} />
              </li>
            ))}
            {hiddenTagCount > 0 && (
              <li>
                <Badge variant="outline">+{hiddenTagCount}</Badge>
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

function TagBadge({ tag }: { tag: ParsedTag }): React.ReactElement {
  if (tag.color && HEX_COLOR_RE.test(tag.color)) {
    return (
      <Badge
        className="border-transparent"
        style={{
          backgroundColor: tag.color,
          color: getContrastColor(tag.color),
        }}
      >
        {tag.name}
      </Badge>
    );
  }

  return <Badge variant="secondary">{tag.name}</Badge>;
}

/**
 * Returns black or white depending on which provides better contrast
 * against the given hex background color.
 */
export function getContrastColor(hex: string): string {
  const cleaned = hex.replace("#", "");
  const r = Number.parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = Number.parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = Number.parseInt(cleaned.slice(4, 6), 16) / 255;

  // WCAG relative luminance with sRGB gamma correction
  const toLinear = (c: number): number =>
    c <= 0.039_28 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const luminance =
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  // WCAG contrast ratio: (L1 + 0.05) / (L2 + 0.05) where L1 > L2
  const contrastWithWhite = (1 + 0.05) / (luminance + 0.05);
  const contrastWithBlack = (luminance + 0.05) / (0 + 0.05);
  return contrastWithBlack >= contrastWithWhite ? "#000000" : "#ffffff";
}
