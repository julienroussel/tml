import type { Metadata } from "next";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your account and preferences.",
};

export default function SettingsPage(): ReactElement {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-2xl tracking-tight">Settings</h1>
        <p className="max-w-md text-muted-foreground">
          Manage your account and preferences.
        </p>
      </div>
      <Badge variant="secondary">Coming soon</Badge>
    </div>
  );
}
