import { render, screen, within } from "@testing-library/react";
import { Dumbbell, Sparkles, Star } from "lucide-react";
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

// After filtering out repertoire + collect, library group is empty in the grid.
// This matches the real behavior — both have their own dedicated dashboard cards.
const MOCK_LIBRARY: never[] = [];

const MOCK_LAB = [
  {
    slug: "improve" as const,
    icon: Dumbbell,
    enabled: false,
    group: "lab" as const,
  },
  {
    slug: "perform" as const,
    icon: Star,
    enabled: false,
    group: "lab" as const,
  },
];

const MOCK_INSIGHTS = [
  {
    slug: "enhance" as const,
    icon: Sparkles,
    enabled: false,
    group: "insights" as const,
  },
];

vi.mock("@/lib/modules", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/modules")>();
  return {
    MODULE_GROUPS: actual.MODULE_GROUPS,
    MODULE_GROUP_NAV_KEYS: actual.MODULE_GROUP_NAV_KEYS,
    getModulesByGroup: (group: string) => {
      if (group === "library") {
        return MOCK_LIBRARY;
      }
      if (group === "lab") {
        return MOCK_LAB;
      }
      if (group === "insights") {
        return MOCK_INSIGHTS;
      }
      return [];
    },
  };
});

const IMPROVE_RE = /improve/i;

describe("DashboardGrid", () => {
  it("renders grouped sections with headings", async () => {
    const element = await DashboardGrid();
    render(element);
    // Library group is empty (repertoire + collect filtered out — they have dedicated cards)
    expect(screen.queryByText("nav.library")).not.toBeInTheDocument();
    expect(screen.getByText("nav.theLab")).toBeInTheDocument();
    expect(screen.getByText("nav.insights")).toBeInTheDocument();
  });

  it("renders a card for each non-admin, non-repertoire, non-collect module", async () => {
    const element = await DashboardGrid();
    render(element);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
  });

  it("links each card to the correct /{slug} href", async () => {
    const element = await DashboardGrid();
    render(element);
    expect(screen.getByRole("link", { name: IMPROVE_RE })).toHaveAttribute(
      "href",
      "/improve"
    );
  });

  it("shows a coming-soon badge on disabled modules", async () => {
    const element = await DashboardGrid();
    render(element);
    const improveLink = screen.getByRole("link", { name: IMPROVE_RE });
    expect(
      within(improveLink).getByText("common.comingSoon")
    ).toBeInTheDocument();
  });

  it("sets aria-label on disabled module links", async () => {
    const element = await DashboardGrid();
    render(element);
    const improveLink = screen.getByRole("link", { name: IMPROVE_RE });
    expect(improveLink).toHaveAttribute(
      "aria-label",
      "improve.title (common.comingSoon)"
    );
  });

  it("renders module descriptions", async () => {
    const element = await DashboardGrid();
    render(element);
    expect(screen.getByText("improve.description")).toBeInTheDocument();
    expect(screen.getByText("perform.description")).toBeInTheDocument();
    expect(screen.getByText("enhance.description")).toBeInTheDocument();
  });

  it("does not render the admin group", async () => {
    const element = await DashboardGrid();
    render(element);
    expect(screen.queryByText("nav.admin")).not.toBeInTheDocument();
  });
});
