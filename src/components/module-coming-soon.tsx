import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { getModule, type ModuleSlug } from "@/lib/modules";

interface ModuleComingSoonProps {
  slug: ModuleSlug;
}

export async function ModuleComingSoon({
  slug,
}: ModuleComingSoonProps): Promise<ReactElement> {
  const t = await getTranslations();
  const mod = getModule(slug);
  const Icon = mod.icon;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <div className="bg-muted flex size-16 items-center justify-center rounded-2xl">
        <Icon className="text-muted-foreground size-8" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t(`${slug}.title`)}
        </h1>
        <p className="text-muted-foreground max-w-md">
          {t(`${slug}.description`)}
        </p>
      </div>
      <Badge variant="secondary">{t("common.comingSoon")}</Badge>
    </div>
  );
}
