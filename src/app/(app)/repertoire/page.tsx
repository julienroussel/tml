import type { Metadata } from "next";
import type { ReactElement } from "react";
import { RepertoireView } from "@/features/repertoire/components/repertoire-view";

export const metadata: Metadata = {
  title: "Repertoire",
  description: "Your collection of tricks and effects.",
};

export default function RepertoirePage(): ReactElement {
  return <RepertoireView />;
}
