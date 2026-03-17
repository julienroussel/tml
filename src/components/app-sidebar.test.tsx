import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { getAdminModules, getMainModules } from "@/lib/modules";
import { AppSidebar } from "./app-sidebar";

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: { children: ReactNode } & Record<string, unknown>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="next-image" {...props} />
  ),
}));

vi.mock("@/components/sidebar-nav", () => ({
  SidebarNavItem: ({
    children,
    href,
    label,
  }: {
    children: ReactNode;
    href: string;
    label: string;
  }) => (
    <li data-href={href} data-testid="sidebar-nav-item">
      {children}
      <span>{label}</span>
    </li>
  ),
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

vi.mock("@neondatabase/auth/react", () => ({
  UserButton: () => <div data-testid="user-button" />,
}));

vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarGroup: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarGroupContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarGroupLabel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarMenu: ({ children }: { children: ReactNode }) => <ul>{children}</ul>,
  SidebarSeparator: () => <hr />,
}));

describe("AppSidebar", () => {
  it("renders the home/logo link pointing to /dashboard", async () => {
    const element = await AppSidebar();
    render(element);

    const links = screen.getAllByRole("link");
    const homeLink = links.find(
      (link) => link.getAttribute("href") === "/dashboard"
    );
    expect(homeLink).toBeInTheDocument();
  });

  it('renders "The Magic Lab" sr-only text', async () => {
    const element = await AppSidebar();
    render(element);

    const srText = screen.getByText("The Magic Lab");
    expect(srText).toBeInTheDocument();
    expect(srText.className).toContain("sr-only");
  });

  it("renders the Dashboard nav item", async () => {
    const element = await AppSidebar();
    render(element);

    expect(screen.getByText("nav.dashboard")).toBeInTheDocument();
  });

  it("renders all main module nav items", async () => {
    const element = await AppSidebar();
    render(element);

    const mainModules = getMainModules();
    for (const mod of mainModules) {
      expect(screen.getByText(mod.label)).toBeInTheDocument();
    }

    const navItems = screen.getAllByTestId("sidebar-nav-item");
    const mainHrefs = mainModules.map((m) => `/${m.slug}`);
    const renderedMainItems = navItems.filter((item) =>
      mainHrefs.includes(item.getAttribute("data-href") ?? "")
    );
    expect(renderedMainItems).toHaveLength(mainModules.length);
  });

  it("renders all admin module nav items", async () => {
    const element = await AppSidebar();
    render(element);

    const adminModules = getAdminModules();
    for (const mod of adminModules) {
      expect(screen.getAllByText(mod.label).length).toBeGreaterThanOrEqual(1);
    }

    const navItems = screen.getAllByTestId("sidebar-nav-item");
    const adminHrefs = adminModules.map((m) => `/${m.slug}`);
    const renderedAdminItems = navItems.filter((item) =>
      adminHrefs.includes(item.getAttribute("data-href") ?? "")
    );
    expect(renderedAdminItems).toHaveLength(adminModules.length);
  });

  it("renders the Settings nav item", async () => {
    const element = await AppSidebar();
    render(element);

    expect(screen.getByText("nav.settings")).toBeInTheDocument();
    const navItems = screen.getAllByTestId("sidebar-nav-item");
    const settingsItem = navItems.find(
      (item) => item.getAttribute("data-href") === "/settings"
    );
    expect(settingsItem).toBeInTheDocument();
  });
});
