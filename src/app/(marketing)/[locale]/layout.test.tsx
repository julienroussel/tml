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

const providersPropsSpy = vi.fn();
vi.mock("@/components/providers", () => ({
  Providers: (props: Record<string, unknown>) => {
    providersPropsSpy(props);
    return <>{props.children}</>;
  },
}));

describe("MarketingLayout", () => {
  const defaultProps = {
    children: <div>page content</div>,
    params: Promise.resolve({ locale: "en" }),
  };

  it("renders header, main content, and footer", async () => {
    render(await MarketingLayout(defaultProps));

    expect(
      screen.getByRole("navigation", { name: "Main navigation" })
    ).toBeInTheDocument();
    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Footer links" })
    ).toBeInTheDocument();
  });

  it("renders the logo with sr-only text", async () => {
    render(await MarketingLayout(defaultProps));

    expect(screen.getByText("The Magic Lab")).toBeInTheDocument();
  });

  it("renders footer links with locale prefix", async () => {
    render(await MarketingLayout(defaultProps));

    expect(screen.getByText("footer.privacy")).toBeInTheDocument();
    expect(screen.getByText("footer.faq")).toBeInTheDocument();
    expect(screen.getByText("footer.gitHub")).toBeInTheDocument();

    const privacyLink = screen.getByText("footer.privacy").closest("a");
    expect(privacyLink).toHaveAttribute("href", "/en/privacy");

    const faqLink = screen.getByText("footer.faq").closest("a");
    expect(faqLink).toHaveAttribute("href", "/en/faq");
  });

  it("renders copyright with current year", async () => {
    render(await MarketingLayout(defaultProps));

    const year = new Date().getFullYear();
    expect(
      screen.getByText(`footer.copyright (year: ${year})`)
    ).toBeInTheDocument();
  });

  it("renders the skip-to-content link", async () => {
    render(await MarketingLayout(defaultProps));

    const skipLink = screen.getByText("common.skipToContent");
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute("href", "#main-content");
  });

  it("sets lang attribute on content wrapper", async () => {
    render(await MarketingLayout(defaultProps));

    const wrapper = screen.getByText("page content").closest("[lang]");
    expect(wrapper).toHaveAttribute("lang", "en");
  });

  it("passes locale and messages to Providers", async () => {
    providersPropsSpy.mockClear();
    render(await MarketingLayout(defaultProps));

    expect(providersPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "en",
        messages: {},
      })
    );
  });

  it("passes non-default locale to Providers", async () => {
    providersPropsSpy.mockClear();
    render(
      await MarketingLayout({
        children: <div>content</div>,
        params: Promise.resolve({ locale: "fr" }),
      })
    );

    expect(providersPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "fr",
        messages: {},
      })
    );
  });

  it("renders locale-prefixed links for non-default locale", async () => {
    render(
      await MarketingLayout({
        children: <div>content</div>,
        params: Promise.resolve({ locale: "fr" }),
      })
    );

    const privacyLink = screen.getByText("footer.privacy").closest("a");
    expect(privacyLink).toHaveAttribute("href", "/fr/privacy");

    const wrapper = screen.getByText("content").closest("[lang]");
    expect(wrapper).toHaveAttribute("lang", "fr");
  });
});
