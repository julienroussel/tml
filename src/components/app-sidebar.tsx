import { LayoutDashboard, UserCog } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
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

export function AppSidebar(): ReactElement {
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
              <SidebarNavItem href="/dashboard" label="Dashboard">
                <LayoutDashboard />
              </SidebarNavItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>Modules</SidebarGroupLabel>
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
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
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
          <SidebarNavItem href="/settings" label="Settings">
            <UserCog />
          </SidebarNavItem>
        </SidebarMenu>
        <div className="flex items-center justify-end px-2">
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
