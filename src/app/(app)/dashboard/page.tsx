import type { Metadata } from "next";
import type { ReactElement } from "react";
import { DashboardGrid } from "@/components/dashboard-grid";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your personal magic workspace at a glance.",
};

export default function DashboardPage(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to The Magic Lab. Choose a module to get started.
        </p>
      </div>
      <DashboardGrid />
    </div>
  );
}
