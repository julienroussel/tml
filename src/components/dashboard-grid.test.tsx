import { render, screen, within } from "@testing-library/react";
import { Dumbbell, Star } from "lucide-react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DashboardGrid } from "./dashboard-grid";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: { children: ReactNode; href: string } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// One enabled + one disabled to exercise both badge-visible and badge-hidden paths
const MOCK_MODULES = [
  {
    slug: "improve" as const,
    icon: Dumbbell,
    enabled: true,
    group: "main" as const,
  },
  {
    slug: "perform" as const,
    icon: Star,
    enabled: false,
    group: "main" as const,
  },
];

vi.mock("@/lib/modules", () => ({
  getMainModules: () => MOCK_MODULES,
}));

const IMPROVE_RE = /improve/i;
const PERFORM_RE = /perform/i;

describe("DashboardGrid", () => {
  it("renders a card for each main module", async () => {
    const element = await DashboardGrid();
    render(element);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
  });

  it("links each card to the correct /{slug} href", async () => {
    const element = await DashboardGrid();
    render(element);
    expect(screen.getByRole("link", { name: IMPROVE_RE })).toHaveAttribute(
      "href",
      "/improve"
    );
    expect(screen.getByRole("link", { name: PERFORM_RE })).toHaveAttribute(
      "href",
      "/perform"
    );
  });

  it("shows a coming-soon badge only for disabled modules", async () => {
    const element = await DashboardGrid();
    render(element);
    const performLink = screen.getByRole("link", { name: PERFORM_RE });
    expect(
      within(performLink).getByText("common.comingSoon")
    ).toBeInTheDocument();
    const improveLink = screen.getByRole("link", { name: IMPROVE_RE });
    expect(
      within(improveLink).queryByText("common.comingSoon")
    ).not.toBeInTheDocument();
  });

  it("sets aria-label on disabled module links", async () => {
    const element = await DashboardGrid();
    render(element);
    expect(screen.getByRole("link", { name: PERFORM_RE })).toHaveAttribute(
      "aria-label",
      "perform.title (common.comingSoon)"
    );
    const improveLink = screen.getByRole("link", { name: IMPROVE_RE });
    expect(improveLink).not.toHaveAttribute("aria-label");
  });

  it("renders module descriptions", async () => {
    const element = await DashboardGrid();
    render(element);
    expect(screen.getByText("improve.description")).toBeInTheDocument();
    expect(screen.getByText("perform.description")).toBeInTheDocument();
  });
});
