import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";
import { CollectView } from "@/features/collect/components/collect-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("collect");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function CollectPage(): ReactElement {
  return <CollectView />;
}
