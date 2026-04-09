export const dynamic = "force-dynamic";

import { ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import type { ReactElement, ReactNode } from "react";
import { isUserBanned } from "@/auth/ban-check";
import { getOrEnsureUserSettings } from "@/auth/ensure-user";
import { auth } from "@/auth/server";
import { AppSidebar } from "@/components/app-sidebar";
import { HeaderTitle } from "@/components/header-title";
import { Providers } from "@/components/providers";
import { SyncStatus } from "@/components/sync-status";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { SettingsRestorer } from "@/features/settings/components/settings-restorer";
import { defaultLocale, isLocale } from "@/i18n/config";
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
  // Both paths verify ban status — null means banned or unexpected DB issue.
  const settings = await getOrEnsureUserSettings(session);

  if (!settings) {
    // Confirm ban status to show the appropriate UI. On the fast path,
    // isUserBanned() already ran inside getOrEnsureUserSettings(); this
    // second call only fires for the (rare) banned-user case.
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
    // Non-ban null (e.g., upsert returned zero rows). Redirect as fallback.
    redirect("/auth/sign-in");
  }

  // Locale restoration from DB is handled client-side by LocaleRestorer
  // (rendered below). Server Components cannot reliably set cookies in
  // Next.js — only Server Actions, Route Handlers, and Proxy can.

  const [locale, messages, t] = await Promise.all([
    getLocale(),
    getMessages(),
    getTranslations("common"),
  ]);
  const typedLocale = isLocale(locale) ? locale : defaultLocale;

  return (
    <Providers locale={typedLocale} messages={messages}>
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:shadow-md"
        href="#main-content"
      >
        {t("skipToContent")}
      </a>
      <PowerSyncProvider>
        <SyncErrorToaster />
        <SettingsRestorer
          dbLocale={settings.locale}
          dbTheme={settings.theme}
          userId={session.user.id}
        />
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-12 items-center gap-2 border-b px-4">
              <SidebarTrigger />
              <Separator className="h-4" orientation="vertical" />
              <HeaderTitle />
              <div className="ml-auto">
                <SyncStatus />
              </div>
            </header>
            <main className="flex flex-1 flex-col p-4" id="main-content">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </PowerSyncProvider>
    </Providers>
  );
}
