"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import type { KeyboardEvent } from "react";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { DIFFICULTY_LABELS } from "../constants";

const MAX_STARS = DIFFICULTY_LABELS.length;

const SIZES = {
  sm: 16,
  md: 20,
} as const;

/** Returns 0 for the focusable star, -1 for the rest (roving tabindex). */
function starTabIndex(star: number, value: number | null): 0 | -1 {
  const focusableStar = value ?? 1;
  return star === focusableStar ? 0 : -1;
}

interface TrickDifficultyProps {
  onChange?: (value: number | null) => void;
  readOnly?: boolean;
  size?: "sm" | "md";
  value: number | null;
}

export function TrickDifficulty({
  value,
  onChange,
  readOnly = false,
  size = "md",
}: TrickDifficultyProps): React.ReactElement {
  const t = useTranslations("repertoire");
  const isInteractive = !readOnly && onChange !== undefined;
  const iconSize = SIZES[size];
  const starRefs = useRef<(HTMLSpanElement | null)[]>([]);

  function handleClick(star: number): void {
    if (!isInteractive) {
      return;
    }
    onChange(value === star ? null : star);
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (!isInteractive) {
      return;
    }

    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp": {
        event.preventDefault();
        const next = Math.min((value ?? 0) + 1, MAX_STARS);
        onChange(next);
        starRefs.current[next - 1]?.focus();
        break;
      }
      case "ArrowLeft":
      case "ArrowDown": {
        event.preventDefault();
        const prev = (value ?? 2) - 1;
        onChange(prev < 1 ? null : prev);
        const focusIndex = prev < 1 ? 0 : prev - 1;
        starRefs.current[focusIndex]?.focus();
        break;
      }
      case "Delete":
      case "Backspace": {
        event.preventDefault();
        onChange(null);
        starRefs.current[0]?.focus();
        break;
      }
      default:
        break;
    }
  }

  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-label is valid on both role="radiogroup" and role="img" per WAI-ARIA spec; Biome false positive on conditional role
    <div
      aria-label={
        isInteractive
          ? t("difficulty")
          : `${t("difficulty")}: ${String(value ?? 0)}/5`
      }
      className="inline-flex items-center gap-0.5"
      role={isInteractive ? "radiogroup" : "img"}
    >
      {Array.from({ length: MAX_STARS }, (_, i) => {
        const star = i + 1;
        const isFilled = value !== null && star <= value;

        return (
          <span
            {...(isInteractive
              ? {
                  "aria-checked": isFilled,
                  "aria-label": t(`difficultyLabel.${String(star)}`),
                  onClick: () => handleClick(star),
                  onKeyDown: handleKeyDown,
                  role: "radio" as const,
                  tabIndex: starTabIndex(star, value),
                }
              : { "aria-hidden": true as const })}
            className={cn(
              isInteractive &&
                "min-h-11 min-w-11 cursor-pointer items-center justify-center",
              isInteractive
                ? "inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                : "inline-flex items-center justify-center",
              isFilled ? "text-amber-500" : "text-muted-foreground/30"
            )}
            key={star}
            ref={(el) => {
              starRefs.current[i] = el;
            }}
          >
            <Star className={cn(isFilled && "fill-current")} size={iconSize} />
          </span>
        );
      })}
    </div>
  );
}
