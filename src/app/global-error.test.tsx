import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GlobalError from "./global-error";

describe("GlobalError", () => {
  beforeEach(() => {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress console.error output during tests
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the error heading", () => {
    render(<GlobalError error={new Error("test")} reset={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: "Something went wrong" })
    ).toBeInTheDocument();
  });

  it("renders the retry button", () => {
    render(<GlobalError error={new Error("test")} reset={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument();
  });

  it("calls reset when retry button is clicked", async () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("test")} reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("moves focus to the main element on mount", () => {
    render(<GlobalError error={new Error("test")} reset={vi.fn()} />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(document.activeElement).toBe(main);
  });

  it("has role=alert on the error message container", () => {
    render(<GlobalError error={new Error("test")} reset={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders html element with lang attribute", () => {
    render(<GlobalError error={new Error("test")} reset={vi.fn()} />);
    const html = document.querySelector("html");
    expect(html).toHaveAttribute("lang", "en");
  });

  it("sets document.title on mount", () => {
    render(<GlobalError error={new Error("test")} reset={vi.fn()} />);
    expect(document.title).toBe("Error | The Magic Lab");
  });

  it("restores document.title on unmount", () => {
    document.title = "Previous Title";
    const { unmount } = render(
      <GlobalError error={new Error("test")} reset={vi.fn()} />
    );
    expect(document.title).toBe("Error | The Magic Lab");
    unmount();
    expect(document.title).toBe("Previous Title");
  });

  it("re-focuses main when error changes", () => {
    const { rerender } = render(
      <GlobalError error={new Error("first")} reset={vi.fn()} />
    );
    const main = screen.getByRole("main");
    (document.activeElement as HTMLElement)?.blur();
    expect(document.activeElement).not.toBe(main);
    rerender(<GlobalError error={new Error("second")} reset={vi.fn()} />);
    expect(document.activeElement).toBe(main);
  });
});
