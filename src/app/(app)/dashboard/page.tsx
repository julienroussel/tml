import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";
import { auth } from "@/auth/server";
import { CollectionCard } from "@/components/collection-card";
import { DashboardGrid } from "@/components/dashboard-grid";
import { RepertoireCard } from "@/components/repertoire-card";
import { RecentActivityCard } from "@/features/activity/components/recent-activity-card";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your personal magic workspace at a glance.",
};

export default async function DashboardPage(): Promise<ReactElement> {
  const t = await getTranslations("dashboard");
  const { data: session } = await auth.getSession();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {session?.user
            ? t("welcomeBack", {
                name: session.user.name ?? t("fallbackName"),
              })
            : t("welcome")}
        </p>
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-4">
          <RepertoireCard />
          <CollectionCard />
        </div>
        <RecentActivityCard />
      </div>
      <DashboardGrid />
    </div>
  );
}
