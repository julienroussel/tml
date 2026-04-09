"use client";

import { UserButton } from "@neondatabase/auth/react";
import { LayoutDashboard, UserCog } from "lucide-react";
import { useTranslations } from "next-intl";
import { Fragment, type ReactElement } from "react";
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
import {
  getModulesByGroup,
  MODULE_GROUP_NAV_KEYS,
  MODULE_GROUPS,
} from "@/lib/modules";

export function AppSidebar(): ReactElement {
  const t = useTranslations("nav");

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
        {MODULE_GROUPS.map((group) => {
          const modules = getModulesByGroup(group);
          const navKey = MODULE_GROUP_NAV_KEYS[group];
          return (
            <Fragment key={group}>
              <SidebarSeparator />
              <SidebarGroup>
                <SidebarGroupLabel>{t(navKey)}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {modules.map((mod) => {
                      const Icon = mod.icon;
                      return (
                        <SidebarNavItem
                          href={`/${mod.slug}`}
                          key={mod.slug}
                          label={t(mod.slug)}
                        >
                          <Icon />
                        </SidebarNavItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </Fragment>
          );
        })}
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
