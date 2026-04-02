import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getMainModules } from "@/lib/modules";

export async function DashboardGrid(): Promise<ReactElement> {
  const t = await getTranslations();
  const mainModules = getMainModules();
  return (
    <nav aria-label="Modules">
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mainModules.map((mod) => {
          const Icon = mod.icon;
          const title = t(`${mod.slug}.title`);
          return (
            <li key={mod.slug}>
              <Link
                aria-label={
                  mod.enabled
                    ? undefined
                    : `${title} (${t("common.comingSoon")})`
                }
                className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                href={`/${mod.slug}`}
              >
                <Card className="h-full transition-colors focus-within:bg-muted/50 hover:bg-muted/50">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Icon className="size-5 text-muted-foreground" />
                      </div>
                      <div className="flex flex-1 flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <CardTitle>{title}</CardTitle>
                          {!mod.enabled && (
                            <Badge variant="secondary">
                              {t("common.comingSoon")}
                            </Badge>
                          )}
                        </div>
                        <CardDescription>
                          {t(`${mod.slug}.description`)}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
