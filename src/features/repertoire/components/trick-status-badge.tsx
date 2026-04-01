"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { STATUS_CONFIG, type TrickStatus } from "../constants";

interface TrickStatusBadgeProps {
  status: TrickStatus;
}

export function TrickStatusBadge({
  status,
}: TrickStatusBadgeProps): React.ReactElement {
  const t = useTranslations("repertoire");
  const config = STATUS_CONFIG[status];

  return <Badge variant={config.variant}>{t(config.label)}</Badge>;
}
