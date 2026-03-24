import { UserButton } from "@neondatabase/auth/react";
import { LayoutDashboard, UserCog } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";
import { Logo } from "@/components/logo";
import { SidebarNavItem } from "@/components/sidebar-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { getAdminModules, getMainModules } from "@/lib/modules";

export async function AppSidebar(): Promise<ReactElement> {
  const t = await getTranslations("nav");
  const mainModules = getMainModules();
  const adminModules = getAdminModules();

  return (
    <Sidebar>
      <SidebarHeader>
        <Logo
          className="block px-2 py-1"
          height={200}
          href="/dashboard"
          width={600}
        />
      </SidebarHeader>
      <SidebarContent className="overflow-x-hidden">
        <SidebarGroup className="pt-0">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarNavItem href="/dashboard" label={t("dashboard")}>
                <LayoutDashboard />
              </SidebarNavItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>{t("modules")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainModules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <SidebarNavItem
                    href={`/${mod.slug}`}
                    key={mod.slug}
                    label={mod.label}
                  >
                    <Icon />
                  </SidebarNavItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>{t("admin")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminModules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <SidebarNavItem
                    href={`/${mod.slug}`}
                    key={mod.slug}
                    label={mod.label}
                  >
                    <Icon />
                  </SidebarNavItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarNavItem href="/settings" label={t("settings")}>
            <UserCog />
          </SidebarNavItem>
        </SidebarMenu>
        <div className="flex items-center justify-between px-2">
          <UserButton size="icon" />
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
