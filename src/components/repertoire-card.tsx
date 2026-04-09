import { ChevronRight, WandSparkles } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface RepertoireCardProps {
  trickCount: number;
}

export async function RepertoireCard({
  trickCount,
}: RepertoireCardProps): Promise<ReactElement> {
  const t = await getTranslations("dashboard");

  return (
    <Link
      aria-label={t("repertoireLink")}
      className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      href="/repertoire"
    >
      <Card className="border-l-4 border-l-primary transition-colors hover:bg-muted/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary">
              <WandSparkles className="size-5 text-primary-foreground" />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <CardTitle>{t("repertoireTitle")}</CardTitle>
              <CardDescription>
                {t("repertoireDescription", { count: trickCount })}
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
