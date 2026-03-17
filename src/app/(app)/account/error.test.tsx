import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AccountError from "./error";

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: { children: ReactNode } & Record<string, unknown>) => (
    <a {...props}>{children}</a>
  ),
}));

describe("AccountError", () => {
  beforeEach(() => {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress console.error output during tests
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders an error heading", () => {
    render(<AccountError error={new Error("test")} reset={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: "errors.somethingWrong" })
    ).toBeInTheDocument();
  });

  it("renders a description paragraph", () => {
    render(<AccountError error={new Error("test")} reset={vi.fn()} />);
    const alert = screen.getByRole("alert");
    const paragraph = alert.querySelector("p");
    expect(paragraph).toBeInTheDocument();
    expect(paragraph?.textContent?.length).toBeGreaterThan(0);
  });

  it("renders the alert role for accessibility", () => {
    render(<AccountError error={new Error("test")} reset={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders a retry button", () => {
    render(<AccountError error={new Error("test")} reset={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "errors.tryAgain" })
    ).toBeInTheDocument();
  });

  it("calls reset when retry button is clicked", async () => {
    const reset = vi.fn();
    render(<AccountError error={new Error("test")} reset={reset} />);
    await userEvent.click(
      screen.getByRole("button", { name: "errors.tryAgain" })
    );
    expect(reset).toHaveBeenCalledOnce();
  });

  it("renders a link back to dashboard", () => {
    render(<AccountError error={new Error("test")} reset={vi.fn()} />);
    const dashboardLink = screen.getByRole("link", {
      name: "common.goToDashboard",
    });
    expect(dashboardLink).toBeInTheDocument();
    expect(dashboardLink).toHaveAttribute("href", "/dashboard");
  });

  it("moves focus to the container on mount", () => {
    render(<AccountError error={new Error("test")} reset={vi.fn()} />);
    const container = document.querySelector("[tabindex='-1']");
    expect(container).not.toBeNull();
    expect(document.activeElement).toBe(container);
  });

  it("logs the error to console", () => {
    const error = new Error("test error");
    render(<AccountError error={error} reset={vi.fn()} />);
    expect(console.error).toHaveBeenCalledWith(error);
  });

  it("renders correctly when error has a digest", () => {
    const error = Object.assign(new Error("test"), {
      digest: "NEXT_DIGEST_abc123",
    });
    render(<AccountError error={error} reset={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: "errors.somethingWrong" })
    ).toBeInTheDocument();
  });
});
