import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt: string } & Record<string, unknown>) => (
    <div aria-label={alt} role="presentation" {...props} />
  ),
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">Theme Toggle</button>,
}));

vi.mock("@/components/push-notifications-lazy", () => ({
  PushNotificationsLazy: () => (
    <div data-testid="push-notifications">Push Notifications</div>
  ),
}));

const UNDER_DEVELOPMENT_RE = /under active development/;
const VIEW_ON_GITHUB_RE = /View on GitHub/;

describe("Home", () => {
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

  it("renders the under development message", () => {
    render(<Home />);
    expect(screen.getByText(UNDER_DEVELOPMENT_RE)).toBeInTheDocument();
  });

  it("renders the GitHub link with correct attributes", () => {
    render(<Home />);
    const link = screen.getByRole("link", {
      name: VIEW_ON_GITHUB_RE,
    });
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

  it("renders push notifications component", () => {
    render(<Home />);
    expect(screen.getByTestId("push-notifications")).toBeInTheDocument();
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

  it("marks light logo as hidden in dark mode", () => {
    render(<Home />);
    const lightLogo = screen
      .getAllByRole("presentation")
      .find((img) => img.getAttribute("src") === "/logo-light.svg");
    expect(lightLogo).toBeDefined();
    expect((lightLogo as HTMLElement).className).toContain("dark:hidden");
  });
});
