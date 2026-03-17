import { UserButton } from "@neondatabase/auth/react";
import { LayoutDashboard, UserCog } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";
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
        <Link className="block px-2 py-1" href="/dashboard">
          <Image
            alt=""
            className="block h-auto w-full max-w-[600px] dark:hidden"
            height={200}
            src="/logo-light.svg"
            width={600}
          />
          <Image
            alt=""
            className="hidden h-auto w-full max-w-[600px] dark:block"
            height={200}
            src="/logo-dark.svg"
            width={600}
          />
          <span className="sr-only">The Magic Lab</span>
        </Link>
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
