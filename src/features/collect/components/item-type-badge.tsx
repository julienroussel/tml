"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { type ItemType, TYPE_CONFIG } from "../constants";

interface ItemTypeBadgeProps {
  type: ItemType;
}

export function ItemTypeBadge({
  type,
}: ItemTypeBadgeProps): React.ReactElement {
  const t = useTranslations("collect");
  const config = TYPE_CONFIG[type];

  return <Badge variant={config.variant}>{t(config.label)}</Badge>;
}
