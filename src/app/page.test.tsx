import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt: string } & Record<string, unknown>) => (
    // biome-ignore lint/performance/noImgElement: test mock for next/image
    // biome-ignore lint/correctness/useImageSize: test mock — dimensions passed via props spread
    <img alt={alt} {...props} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: { children: ReactNode } & Record<string, unknown>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">Theme Toggle</button>,
}));

const GITHUB_RE = /GitHub/;

describe("Home (landing page)", () => {
  it("renders the heading", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: "The Magic Lab" })
    ).toBeInTheDocument();
  });

  it("renders the main landmark with correct id", () => {
    render(<Home />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
  });

  it("renders the tagline", () => {
    render(<Home />);
    expect(
      screen.getByText("Train. Plan. Perform. Elevate your magic.")
    ).toBeInTheDocument();
  });

  it("renders the Launch App CTA", () => {
    render(<Home />);
    const cta = screen.getByRole("link", { name: "Launch App" });
    expect(cta).toHaveAttribute("href", "/dashboard");
  });

  it("renders feature pillar section with all 6 modules", () => {
    render(<Home />);
    expect(screen.getByText("Improve")).toBeInTheDocument();
    expect(screen.getByText("Train")).toBeInTheDocument();
    expect(screen.getByText("Plan")).toBeInTheDocument();
    expect(screen.getByText("Perform")).toBeInTheDocument();
    expect(screen.getByText("Enhance")).toBeInTheDocument();
    expect(screen.getByText("Collect")).toBeInTheDocument();
  });

  it("renders the GitHub link with correct attributes", () => {
    render(<Home />);
    const link = screen.getByRole("link", { name: GITHUB_RE });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/julienroussel/tml"
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the theme toggle", () => {
    render(<Home />);
    expect(
      screen.getByRole("button", { name: "Theme Toggle" })
    ).toBeInTheDocument();
  });

  it("renders both logo images", () => {
    render(<Home />);
    const images = screen.getAllByRole("presentation");
    const logos = images.filter(
      (img) =>
        img.getAttribute("src") === "/logo-light.svg" ||
        img.getAttribute("src") === "/logo-dark.svg"
    );
    expect(logos).toHaveLength(2);
  });
});
