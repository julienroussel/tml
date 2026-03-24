import { ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import type { ReactElement, ReactNode } from "react";
import { isUserBanned } from "@/auth/ban-check";
import { getOrEnsureUserSettings } from "@/auth/ensure-user";
import { auth } from "@/auth/server";
import { AppSidebar } from "@/components/app-sidebar";
import { HeaderTitle } from "@/components/header-title";
import { SyncStatus } from "@/components/sync-status";
import { Button } from "@/components/ui/button";
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

  // Pass the pre-fetched session to avoid a duplicate auth.getSession() call.
  // Uses a cookie cache to skip the DB upsert on repeat page loads.
  // Falls through to ensureUserExists() when the cookie is absent or stale.
  const settings = await getOrEnsureUserSettings(session);

  // Unconditional ban check — required because getOrEnsureUserSettings()
  // has a cookie cache fast path that skips the DB entirely. On the cold
  // path (no cache) this is redundant with ensureUserExists(), but the
  // simplicity of always checking outweighs one extra lightweight query.
  if (await isUserBanned(session.user.id)) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h1 className="font-semibold text-2xl">Account Suspended</h1>
        <p className="max-w-md text-muted-foreground">
          Your account has been suspended. If you believe this is a mistake,
          please contact support.
        </p>
        <form action="/api/auth/sign-out" method="post">
          <Button type="submit" variant="outline">
            Sign Out
          </Button>
        </form>
      </main>
    );
  }

  // Locale restoration from DB is handled client-side by LocaleRestorer
  // (rendered below). Server Components cannot reliably set cookies in
  // Next.js — only Server Actions, Route Handlers, and Proxy can.

  return (
    <PowerSyncProvider>
      <SyncErrorToaster />
      {settings && (
        <SettingsRestorer
          dbLocale={settings.locale}
          dbTheme={settings.theme}
          userId={session.user.id}
        />
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
