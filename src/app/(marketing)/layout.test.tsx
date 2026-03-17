import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import MarketingLayout from "./layout";

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

vi.mock("@/components/marketing-auth-buttons", () => ({
  MarketingAuthButtons: () => (
    <div data-testid="marketing-auth-buttons">auth buttons</div>
  ),
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">theme toggle</div>,
}));

describe("MarketingLayout", () => {
  it("renders header, main content, and footer", async () => {
    const element = await MarketingLayout({
      children: <div>page content</div>,
    });
    render(element);

    expect(
      screen.getByRole("navigation", { name: "Main navigation" })
    ).toBeInTheDocument();
    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Footer links" })
    ).toBeInTheDocument();
  });

  it("renders the logo with sr-only text", async () => {
    const element = await MarketingLayout({ children: <div>test</div> });
    render(element);

    expect(screen.getByText("The Magic Lab")).toBeInTheDocument();
  });

  it("renders footer links", async () => {
    const element = await MarketingLayout({ children: <div>test</div> });
    render(element);

    expect(screen.getByText("footer.privacy")).toBeInTheDocument();
    expect(screen.getByText("footer.faq")).toBeInTheDocument();
    expect(screen.getByText("footer.gitHub")).toBeInTheDocument();
  });

  it("renders copyright with current year", async () => {
    const element = await MarketingLayout({ children: <div>test</div> });
    render(element);

    const year = new Date().getFullYear();
    expect(
      screen.getByText(`footer.copyright (year: ${year})`)
    ).toBeInTheDocument();
  });
});
