import { and, count, eq, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";
import { auth } from "@/auth/server";
import { DashboardGrid } from "@/components/dashboard-grid";
import { getDb } from "@/db";
import { tricks } from "@/db/schema/tricks";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your personal magic workspace at a glance.",
};

export default async function DashboardPage(): Promise<ReactElement> {
  const t = await getTranslations("dashboard");
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  let trickCount = 0;

  if (userId) {
    const db = getDb();
    const [result] = await db
      .select({ count: count() })
      .from(tricks)
      .where(and(eq(tricks.userId, userId), isNull(tricks.deletedAt)));
    trickCount = result?.count ?? 0;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {session?.user
            ? t("welcomeBack", {
                name: session.user.name ?? "magician",
                count: trickCount,
              })
            : t("welcome")}
        </p>
      </div>
      <DashboardGrid />
    </div>
  );
}
