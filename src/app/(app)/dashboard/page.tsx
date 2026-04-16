import { and, count, eq, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";
import { auth } from "@/auth/server";
import { CollectionCard } from "@/components/collection-card";
import { DashboardGrid } from "@/components/dashboard-grid";
import { RepertoireCard } from "@/components/repertoire-card";
import { getDb } from "@/db";
import { items } from "@/db/schema/items";
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
  let itemCount = 0;

  if (userId) {
    const db = getDb();
    const [trickRows, itemRows] = await Promise.all([
      db
        .select({ count: count() })
        .from(tricks)
        .where(and(eq(tricks.userId, userId), isNull(tricks.deletedAt))),
      db
        .select({ count: count() })
        .from(items)
        .where(and(eq(items.userId, userId), isNull(items.deletedAt))),
    ]);
    trickCount = trickRows[0]?.count ?? 0;
    itemCount = itemRows[0]?.count ?? 0;
  }

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
      <RepertoireCard trickCount={trickCount} />
      <CollectionCard itemCount={itemCount} />
      <DashboardGrid />
    </div>
  );
}
