import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { RepertoireCard } from "./repertoire-card";

const DESCRIPTION_RE = /dashboard\.repertoireDescription/;

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

describe("RepertoireCard", () => {
  it("renders a link to /repertoire", async () => {
    const element = await RepertoireCard({ trickCount: 5 });
    render(element);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/repertoire");
  });

  it("sets an accessible label on the link", async () => {
    const element = await RepertoireCard({ trickCount: 5 });
    render(element);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("aria-label", "dashboard.repertoireLink");
  });

  it("displays the repertoire title", async () => {
    const element = await RepertoireCard({ trickCount: 5 });
    render(element);
    expect(screen.getByText("dashboard.repertoireTitle")).toBeInTheDocument();
  });

  it("displays the trick count description", async () => {
    const element = await RepertoireCard({ trickCount: 0 });
    render(element);
    expect(screen.getByText(DESCRIPTION_RE)).toBeInTheDocument();
  });
});
