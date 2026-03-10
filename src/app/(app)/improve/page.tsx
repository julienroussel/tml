import type { Metadata } from "next";
import type { ReactElement } from "react";
import { ModuleComingSoon } from "@/components/module-coming-soon";
import { getModule } from "@/lib/modules";

const mod = getModule("improve");

export const metadata: Metadata = {
  title: mod.label,
  description: mod.description,
};

export default function ImprovePage(): ReactElement {
  return <ModuleComingSoon slug="improve" />;
}
