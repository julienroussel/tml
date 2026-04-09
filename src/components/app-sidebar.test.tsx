import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { APP_MODULES, getModulesByGroup, MODULE_GROUPS } from "@/lib/modules";
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

  it("renders nav items for all module groups", async () => {
    const element = await AppSidebar();
    render(element);

    const navItems = screen.getAllByTestId("sidebar-nav-item");
    for (const group of MODULE_GROUPS) {
      const modules = getModulesByGroup(group);
      const groupHrefs = modules.map((m) => `/${m.slug}`);
      const rendered = navItems.filter((item) =>
        groupHrefs.includes(item.getAttribute("data-href") ?? "")
      );
      expect(rendered).toHaveLength(modules.length);
    }
  });

  it("renders a nav item for every module", async () => {
    const element = await AppSidebar();
    render(element);

    for (const mod of APP_MODULES) {
      // Some slugs (e.g. "admin") also appear as group labels, so use getAllByText
      expect(
        screen.getAllByText(`nav.${mod.slug}`).length
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("renders group labels for all module groups", async () => {
    const element = await AppSidebar();
    render(element);

    expect(screen.getByText("nav.library")).toBeInTheDocument();
    expect(screen.getByText("nav.theLab")).toBeInTheDocument();
    expect(screen.getByText("nav.insights")).toBeInTheDocument();
    expect(screen.getAllByText("nav.admin").length).toBeGreaterThanOrEqual(1);
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
