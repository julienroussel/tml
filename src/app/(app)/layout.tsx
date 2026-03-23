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
import { SettingsRestorer } from "@/features/settings/components/settings-restorer";
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
  // Returns the user's persisted locale and theme for cookie restoration.
  const settings = await ensureUserExists();

  // Locale restoration from DB is handled client-side by LocaleRestorer
  // (rendered below). Server Components cannot reliably set cookies in
  // Next.js — only Server Actions, Route Handlers, and Proxy can.

  return (
    <PowerSyncProvider>
      <SyncErrorToaster />
      {settings && (
        <SettingsRestorer dbLocale={settings.locale} dbTheme={settings.theme} />
      )}
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
