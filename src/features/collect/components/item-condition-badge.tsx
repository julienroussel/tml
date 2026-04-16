"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { CONDITION_CONFIG, type ItemCondition } from "../constants";

interface ItemConditionBadgeProps {
  condition: ItemCondition;
}

export function ItemConditionBadge({
  condition,
}: ItemConditionBadgeProps): React.ReactElement {
  const t = useTranslations("collect");
  const config = CONDITION_CONFIG[condition];
  const needsAttention = condition === "needs_repair";

  // Adds a glyph so color-blind users and AT consumers can distinguish the
  // warning state without relying on the destructive (red) variant alone.
  return (
    <Badge variant={config.variant}>
      {needsAttention ? (
        <AlertTriangle aria-hidden="true" className="size-3.5" />
      ) : null}
      {t(config.label)}
    </Badge>
  );
}
