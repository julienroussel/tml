import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";
import { ModuleComingSoon } from "@/components/module-coming-soon";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("improve");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function ImprovePage(): ReactElement {
  return <ModuleComingSoon slug="improve" />;
}
