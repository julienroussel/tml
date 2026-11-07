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
import {
  getModulesByGroup,
  MODULE_GROUP_NAV_KEYS,
  MODULE_GROUPS,
} from "@/lib/modules";

const DISPLAY_GROUPS = MODULE_GROUPS.filter((g) => g !== "admin");

export async function DashboardGrid(): Promise<ReactElement> {
  const t = await getTranslations();
  return (
    <div className="flex flex-col gap-8">
      {DISPLAY_GROUPS.map((group) => {
        const modules = getModulesByGroup(group).filter(
          (m) => m.slug !== "repertoire" && m.slug !== "collect"
        );
        if (modules.length === 0) {
          return null;
        }
        const navKey = MODULE_GROUP_NAV_KEYS[group];
        return (
          <section aria-labelledby={`group-${group}`} key={group}>
            <h2
              className="text-muted-foreground mb-4 text-sm font-semibold tracking-wide uppercase"
              id={`group-${group}`}
            >
              {t(`nav.${navKey}`)}
            </h2>
            <nav aria-labelledby={`group-${group}`}>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {modules.map((mod) => {
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
                        className="focus-visible:ring-ring rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                        href={`/${mod.slug}`}
                      >
                        <Card className="focus-within:bg-muted/50 hover:bg-muted/50 h-full transition-colors">
                          <CardHeader>
                            <div className="flex items-center gap-3">
                              <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
                                <Icon className="text-muted-foreground size-5" />
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
          </section>
        );
      })}
    </div>
  );
}
