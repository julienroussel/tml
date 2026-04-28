import type { Metadata } from "next";
import type { ReactElement } from "react";
import { ActivityView } from "@/features/activity/components/activity-view";

export const metadata: Metadata = {
  title: "Activity",
  description: "A timeline of everything you've done in The Magic Lab.",
};

export default function ActivityPage(): ReactElement {
  return <ActivityView />;
}
