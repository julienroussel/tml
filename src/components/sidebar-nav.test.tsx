import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { SidebarNavItem } from "./sidebar-nav";

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: { children: ReactNode } & Record<string, unknown>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("@/components/ui/sidebar", () => ({
  SidebarMenuButton: ({
    children,
    isActive,
  }: {
    children: ReactNode;
    isActive?: boolean;
  } & Record<string, unknown>) => <div data-active={isActive}>{children}</div>,
  SidebarMenuItem: ({ children }: { children: ReactNode }) => (
    <li>{children}</li>
  ),
}));

describe("SidebarNavItem", () => {
  it("renders label and links to correct href", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(
      <SidebarNavItem href="/improve" label="Improve">
        <span data-testid="icon" />
      </SidebarNavItem>
    );

    expect(screen.getByText("Improve")).toBeInTheDocument();
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/improve");
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("is active when pathname exactly matches", () => {
    vi.mocked(usePathname).mockReturnValue("/improve");
    render(
      <SidebarNavItem href="/improve" label="Improve">
        <span />
      </SidebarNavItem>
    );

    const button = screen.getByText("Improve").closest("[data-active]");
    expect(button).not.toBeNull();
    expect(button?.getAttribute("data-active")).toBe("true");
  });

  it("is active when pathname is a sub-route", () => {
    vi.mocked(usePathname).mockReturnValue("/improve/settings");
    render(
      <SidebarNavItem href="/improve" label="Improve">
        <span />
      </SidebarNavItem>
    );

    const button = screen.getByText("Improve").closest("[data-active]");
    expect(button).not.toBeNull();
    expect(button?.getAttribute("data-active")).toBe("true");
  });

  it("is not active when pathname does not match", () => {
    vi.mocked(usePathname).mockReturnValue("/train");
    render(
      <SidebarNavItem href="/improve" label="Improve">
        <span />
      </SidebarNavItem>
    );

    const button = screen.getByText("Improve").closest("[data-active]");
    expect(button).not.toBeNull();
    expect(button?.getAttribute("data-active")).toBe("false");
  });

  it("is not active for prefix-overlapping but different route", () => {
    vi.mocked(usePathname).mockReturnValue("/improvements");
    render(
      <SidebarNavItem href="/improve" label="Improve">
        <span />
      </SidebarNavItem>
    );

    const button = screen.getByText("Improve").closest("[data-active]");
    expect(button).not.toBeNull();
    expect(button?.getAttribute("data-active")).toBe("false");
  });
});
