import { redirect } from "next/navigation";
import type { ReactElement, ReactNode } from "react";
import { ensureUserExists } from "@/auth/ensure-user";
import { auth } from "@/auth/server";
import { AppSidebar } from "@/components/app-sidebar";
import { HeaderTitle } from "@/components/header-title";
import { SyncStatus } from "@/components/sync-status";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { PowerSyncProvider } from "@/sync/provider";
import { SyncErrorToaster } from "@/sync/sync-error-toaster";

export default async function AppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): Promise<ReactElement> {
  const { data: session } = await auth.getSession();
  if (!session) {
    redirect("/auth/sign-in");
  }

  // ensureUserExists is idempotent (INSERT ... ON CONFLICT DO UPDATE).
  // Called unconditionally — the upsert is cheap and avoids cookie-in-render issues.
  await ensureUserExists();

  return (
    <PowerSyncProvider>
      <SyncErrorToaster />
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset id="main-content">
          <header className="flex h-12 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <Separator className="h-4" orientation="vertical" />
            <HeaderTitle />
            <div className="ml-auto">
              <SyncStatus />
            </div>
          </header>
          <div className="flex flex-1 flex-col p-4">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </PowerSyncProvider>
  );
}
