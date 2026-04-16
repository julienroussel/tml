"use client";

import { Edit, Link2, MoreHorizontal, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ItemId } from "@/db/types";
import type { ParsedTag } from "@/features/repertoire/types";
import type { ItemWithRelations } from "../types";
import { ItemConditionBadge } from "./item-condition-badge";
import { ItemTypeBadge } from "./item-type-badge";

interface ItemCardProps {
  item: ItemWithRelations;
  onDelete: (id: ItemId) => void;
  onEdit: (id: ItemId) => void;
}

export const MAX_VISIBLE_TAGS = 3;

export function ItemCard({
  item,
  onEdit,
  onDelete,
}: ItemCardProps): React.ReactElement {
  const t = useTranslations("collect");
  const locale = useLocale();

  function handleEditClick(): void {
    onEdit(item.id);
  }

  // Intl currency formatting so screen readers announce "twelve dollars and
  // fifty cents" rather than the glyph. Currency defaults to USD — update when
  // per-user currency is introduced.
  const formattedPrice =
    item.purchasePrice === null
      ? null
      : new Intl.NumberFormat(locale, {
          style: "currency",
          currency: "USD",
        }).format(item.purchasePrice);

  const visibleTags = item.tags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenTagCount = item.tags.length - MAX_VISIBLE_TAGS;

  return (
    // The Card is a visual container only — interactivity lives on the inner
    // edit button and the dropdown trigger. Nesting interactive elements
    // inside a role="button" Card is invalid HTML and confuses screen readers,
    // so we avoid it by giving each action its own real <button>.
    <Card className="hover:border-ring motion-safe:transition-colors">
      <CardHeader className="relative">
        <div className="flex items-start justify-between gap-2">
          {/* Phrasing-only inside <button> per HTML spec — use <span> with heading styles.
              The name span gets role="heading" aria-level={3} so screen-reader H-key
              navigation still works and the document outline stays intact, matching
              the semantic <h3> used in trick-card.tsx. */}
          <button
            aria-label={`${t("edit")}: ${item.name}`}
            className="min-w-0 flex-1 cursor-pointer rounded-sm text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            onClick={handleEditClick}
            type="button"
          >
            {/* biome-ignore lint/a11y/useSemanticElements: <h3> is phrasing-content-only and invalid inside <button>; the ARIA role preserves H-key nav without breaking HTML. */}
            <span
              aria-level={3}
              className="block truncate font-semibold"
              role="heading"
            >
              {item.name}
            </span>
            {item.description ? (
              <span className="mt-1 line-clamp-2 block font-normal text-muted-foreground text-sm">
                {item.description}
              </span>
            ) : null}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={t("cardActions")}
                className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:transition-colors"
                type="button"
              >
                <MoreHorizontal aria-hidden="true" className="size-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(item.id)}>
                <Edit aria-hidden="true" />
                {t("edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(item.id)}
                variant="destructive"
              >
                <Trash2 aria-hidden="true" />
                {t("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {/* Type and condition badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <ItemTypeBadge type={item.type} />
          {item.condition !== null && (
            <ItemConditionBadge condition={item.condition} />
          )}
        </div>

        {/* Brand, price, quantity */}
        {(item.brand || item.purchasePrice !== null || item.quantity > 1) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm">
            {item.brand && <span>{item.brand}</span>}
            {formattedPrice !== null && (
              <span>
                <span className="sr-only">{t("field.purchasePrice")}: </span>
                {formattedPrice}
              </span>
            )}
            {item.quantity > 1 && (
              <span>{t("quantityLabel", { count: item.quantity })}</span>
            )}
          </div>
        )}

        {/* Linked tricks count */}
        {item.tricks.length > 0 && (
          <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
            <Link2 aria-hidden="true" className="size-3.5" />
            <span>{t("linkedTricksCount", { count: item.tricks.length })}</span>
          </div>
        )}

        {/* Tags */}
        {item.tags.length > 0 && (
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

// ---------------------------------------------------------------------------
// Tag badge with optional color
// ---------------------------------------------------------------------------

export const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

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
