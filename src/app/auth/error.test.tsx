import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AuthError from "./error";

const tryAgainPattern = /tryAgain/;

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: { children: ReactNode } & Record<string, unknown>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt: string } & Record<string, unknown>) => (
    // biome-ignore lint/performance/noImgElement: test mock for next/image
    // biome-ignore lint/correctness/useImageSize: test mock — dimensions passed via props spread
    <img alt={alt} {...props} />
  ),
}));

describe("AuthError", () => {
  beforeEach(() => {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress console.error output during tests
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders an error heading", () => {
    render(<AuthError error={new Error("test")} reset={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders a description paragraph", () => {
    render(<AuthError error={new Error("test")} reset={vi.fn()} />);
    const alert = screen.getByRole("alert");
    const paragraph = alert.querySelector("p");
    expect(paragraph).toBeInTheDocument();
    expect(paragraph?.textContent?.length).toBeGreaterThan(0);
  });

  it("renders the alert role for accessibility", () => {
    render(<AuthError error={new Error("test")} reset={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders a retry button", () => {
    render(<AuthError error={new Error("test")} reset={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: tryAgainPattern })
    ).toBeInTheDocument();
  });

  it("calls reset when retry button is clicked", async () => {
    const reset = vi.fn();
    render(<AuthError error={new Error("test")} reset={reset} />);
    await userEvent.click(
      screen.getByRole("button", { name: tryAgainPattern })
    );
    expect(reset).toHaveBeenCalledOnce();
  });

  it("renders links back to home", () => {
    render(<AuthError error={new Error("test")} reset={vi.fn()} />);
    const homeLinks = screen.getAllByRole("link");
    expect(homeLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of homeLinks) {
      expect(link).toHaveAttribute("href", "/");
    }
  });

  it("moves focus to the container on mount", () => {
    render(<AuthError error={new Error("test")} reset={vi.fn()} />);
    const container = document.querySelector("[tabindex='-1']");
    expect(container).not.toBeNull();
    expect(document.activeElement).toBe(container);
  });

  it("logs the error to console", () => {
    const error = new Error("test error");
    render(<AuthError error={error} reset={vi.fn()} />);
    expect(console.error).toHaveBeenCalledWith(error);
  });

  it("renders correctly when error has a digest", () => {
    const error = Object.assign(new Error("test"), {
      digest: "NEXT_DIGEST_abc123",
    });
    render(<AuthError error={error} reset={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
