import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your account and preferences.",
};

export default async function SettingsPage(): Promise<ReactElement> {
  const t = await getTranslations("settings");
  const tCommon = await getTranslations("common");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-2xl tracking-tight">{t("title")}</h1>
        <p className="max-w-md text-muted-foreground">{t("description")}</p>
      </div>
      <Badge variant="secondary">{tCommon("comingSoon")}</Badge>
    </div>
  );
}
