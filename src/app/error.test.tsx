import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ErrorPage from "./error";

describe("ErrorPage", () => {
  beforeEach(() => {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress console.error output during tests
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the error heading", () => {
    render(<ErrorPage error={new Error("test")} reset={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: "errors.somethingWrong" })
    ).toBeInTheDocument();
  });

  it("renders the retry button", () => {
    render(<ErrorPage error={new Error("test")} reset={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "errors.tryAgain" })
    ).toBeInTheDocument();
  });

  it("calls reset when retry button is clicked", async () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("test")} reset={reset} />);
    await userEvent.click(
      screen.getByRole("button", { name: "errors.tryAgain" })
    );
    expect(reset).toHaveBeenCalledOnce();
  });

  it("calls reset when retry button is activated via keyboard (Enter)", async () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("test")} reset={reset} />);
    const button = screen.getByRole("button", { name: "errors.tryAgain" });
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(reset).toHaveBeenCalledOnce();
  });

  it("calls reset when retry button is activated via keyboard (Space)", async () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("test")} reset={reset} />);
    const button = screen.getByRole("button", { name: "errors.tryAgain" });
    button.focus();
    await userEvent.keyboard(" ");
    expect(reset).toHaveBeenCalledOnce();
  });

  it("logs the error to console", () => {
    const error = new Error("test error");
    render(<ErrorPage error={error} reset={vi.fn()} />);
    expect(console.error).toHaveBeenCalledWith(error);
  });

  it("sets document.title on mount", () => {
    render(<ErrorPage error={new Error("test")} reset={vi.fn()} />);
    expect(document.title).toBe("Error | The Magic Lab");
  });

  it("restores document.title on unmount", () => {
    document.title = "Previous Title";
    const { unmount } = render(
      <ErrorPage error={new Error("test")} reset={vi.fn()} />
    );
    expect(document.title).toBe("Error | The Magic Lab");
    unmount();
    expect(document.title).toBe("Previous Title");
  });

  it("moves focus to the main element on mount", () => {
    render(<ErrorPage error={new Error("test")} reset={vi.fn()} />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(document.activeElement).toBe(main);
  });

  it("renders correctly when error has a digest", () => {
    const error = Object.assign(new Error("test"), {
      digest: "NEXT_DIGEST_abc123",
    });
    render(<ErrorPage error={error} reset={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: "errors.somethingWrong" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "errors.tryAgain" })
    ).toBeInTheDocument();
  });
});
