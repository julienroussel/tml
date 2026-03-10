import type { Metadata } from "next";
import type { ReactElement } from "react";
import { ModuleComingSoon } from "@/components/module-coming-soon";
import { getModule } from "@/lib/modules";

const mod = getModule("enhance");

export const metadata: Metadata = {
  title: mod.label,
  description: mod.description,
};

export default function EnhancePage(): ReactElement {
  return <ModuleComingSoon slug="enhance" />;
}
