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
    label: "Improve",
    description: "Track practice",
    icon: Dumbbell,
    enabled: true,
    group: "main" as const,
  },
  {
    slug: "perform" as const,
    label: "Perform",
    description: "Log performances",
    icon: Star,
    enabled: false,
    group: "main" as const,
  },
];

vi.mock("@/lib/modules", () => ({
  getMainModules: () => MOCK_MODULES,
}));

const IMPROVE_RE = /Improve/;
const PERFORM_RE = /Perform/;

describe("DashboardGrid", () => {
  it("renders a card for each main module", () => {
    render(<DashboardGrid />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
  });

  it("links each card to the correct /{slug} href", () => {
    render(<DashboardGrid />);
    expect(screen.getByRole("link", { name: IMPROVE_RE })).toHaveAttribute(
      "href",
      "/improve"
    );
    expect(screen.getByRole("link", { name: PERFORM_RE })).toHaveAttribute(
      "href",
      "/perform"
    );
  });

  it("shows a 'Soon' badge only for disabled modules", () => {
    render(<DashboardGrid />);
    const performLink = screen.getByRole("link", { name: PERFORM_RE });
    expect(within(performLink).getByText("Soon")).toBeInTheDocument();
    const improveLink = screen.getByRole("link", { name: IMPROVE_RE });
    expect(within(improveLink).queryByText("Soon")).not.toBeInTheDocument();
  });

  it("sets aria-label on disabled module links", () => {
    render(<DashboardGrid />);
    expect(screen.getByRole("link", { name: PERFORM_RE })).toHaveAttribute(
      "aria-label",
      "Perform (coming soon)"
    );
    const improveLink = screen.getByRole("link", { name: IMPROVE_RE });
    expect(improveLink).not.toHaveAttribute("aria-label");
  });

  it("renders module descriptions", () => {
    render(<DashboardGrid />);
    expect(screen.getByText("Track practice")).toBeInTheDocument();
    expect(screen.getByText("Log performances")).toBeInTheDocument();
  });
});
