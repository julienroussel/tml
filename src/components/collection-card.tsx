"use client";

import { ChevronRight, Package } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { type ReactElement, useEffect } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useItemCount } from "@/features/collect/hooks/use-item-count";

function CollectionCard(): ReactElement {
  const t = useTranslations("dashboard");
  const { count, isLoading, error } = useItemCount();

  // Em-dash on error keeps the card usable as a nav tile; the loading
  // skeleton would otherwise persist indefinitely on hook failure.
  useEffect(() => {
    if (error) {
      console.error("CollectionCard: failed to load item count", error);
    }
  }, [error]);

  return (
    <Link
      aria-label={t("collectionLink")}
      className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      href="/collect"
    >
      <Card className="border-l-4 border-l-primary transition-colors hover:bg-muted/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary">
              <Package
                aria-hidden="true"
                className="size-5 text-primary-foreground"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <CardTitle>{t("collectionTitle")}</CardTitle>
              <CardDescription aria-busy={isLoading ? true : undefined}>
                {renderDescription({ count, error, isLoading, t })}
              </CardDescription>
            </div>
            <ChevronRight
              aria-hidden="true"
              className="size-5 shrink-0 text-muted-foreground"
            />
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}

interface RenderDescriptionArgs {
  count: number;
  error: Error | null;
  isLoading: boolean;
  t: ReturnType<typeof useTranslations<"dashboard">>;
}

function renderDescription({
  count,
  error,
  isLoading,
  t,
}: RenderDescriptionArgs): ReactElement | string {
  if (error) {
    return "—";
  }
  if (isLoading) {
    return <Skeleton className="h-4 w-32" />;
  }
  return t("collectionDescription", { count });
}

export { CollectionCard };
