import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Not Found",
};

export default async function NotFound(): Promise<ReactElement> {
  const t = await getTranslations("errors");

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-4"
      id="main-content"
    >
      <h1 className="font-semibold text-xl">{t("notFound")}</h1>
      <p className="text-muted-foreground">{t("notFoundDesc")}</p>
      <Button asChild>
        <Link href="/">{t("goHome")}</Link>
      </Button>
    </main>
  );
}
