import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ErrorPage from "@/app/error";
import { TestErrorBoundary } from "@/test/error-boundary";

/**
 * Creates a component controlled by a mutable flag.
 * React 19 concurrent rendering retries synchronously after a throw,
 * so a render-count approach is unreliable. Use `shouldThrow.current`
 * to control behaviour explicitly.
 */
function createThrowingComponent(shouldThrow: {
  current: boolean;
}): () => ReactElement {
  return function ThrowingComponent(): ReactElement {
    if (shouldThrow.current) {
      throw new Error("Simulated render error");
    }
    return <div data-testid="recovered-content">Recovered</div>;
  };
}

describe("Dashboard error boundary integration", () => {
  beforeEach(() => {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress console.error output during tests
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders error heading when child component throws", () => {
    const flag = { current: true };
    const Throwing = createThrowingComponent(flag);
    render(
      <TestErrorBoundary errorComponent={ErrorPage}>
        <Throwing />
      </TestErrorBoundary>
    );

    expect(
      screen.getByRole("heading", { name: "errors.somethingWrong" })
    ).toBeInTheDocument();
  });

  it("renders error description when child component throws", () => {
    const flag = { current: true };
    const Throwing = createThrowingComponent(flag);
    render(
      <TestErrorBoundary errorComponent={ErrorPage}>
        <Throwing />
      </TestErrorBoundary>
    );

    expect(screen.getByText("errors.unexpectedError")).toBeInTheDocument();
  });

  it("renders retry button when child component throws", () => {
    const flag = { current: true };
    const Throwing = createThrowingComponent(flag);
    render(
      <TestErrorBoundary errorComponent={ErrorPage}>
        <Throwing />
      </TestErrorBoundary>
    );

    expect(
      screen.getByRole("button", { name: "errors.tryAgain" })
    ).toBeInTheDocument();
  });

  it("renders alert role for screen readers", () => {
    const flag = { current: true };
    const Throwing = createThrowingComponent(flag);
    render(
      <TestErrorBoundary errorComponent={ErrorPage}>
        <Throwing />
      </TestErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("retry re-renders children after error is cleared", async () => {
    const flag = { current: true };
    const Throwing = createThrowingComponent(flag);
    render(
      <TestErrorBoundary errorComponent={ErrorPage}>
        <Throwing />
      </TestErrorBoundary>
    );

    expect(
      screen.getByRole("heading", { name: "errors.somethingWrong" })
    ).toBeInTheDocument();

    flag.current = false;

    await userEvent.click(
      screen.getByRole("button", { name: "errors.tryAgain" })
    );

    expect(screen.getByTestId("recovered-content")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "errors.somethingWrong" })
    ).not.toBeInTheDocument();
  });

  it("retry shows error again if component still throws", async () => {
    const flag = { current: true };
    const Throwing = createThrowingComponent(flag);
    render(
      <TestErrorBoundary errorComponent={ErrorPage}>
        <Throwing />
      </TestErrorBoundary>
    );

    await userEvent.click(
      screen.getByRole("button", { name: "errors.tryAgain" })
    );

    expect(
      screen.getByRole("heading", { name: "errors.somethingWrong" })
    ).toBeInTheDocument();
  });

  it("sets document.title when error is caught and restores it after recovery", async () => {
    document.title = "Dashboard | The Magic Lab";
    const flag = { current: true };
    const Throwing = createThrowingComponent(flag);
    render(
      <TestErrorBoundary errorComponent={ErrorPage}>
        <Throwing />
      </TestErrorBoundary>
    );

    expect(document.title).toBe("errors.pageTitle");

    flag.current = false;
    await userEvent.click(
      screen.getByRole("button", { name: "errors.tryAgain" })
    );

    expect(document.title).toBe("Dashboard | The Magic Lab");
  });

  it("moves focus to the main element when boundary catches", () => {
    const flag = { current: true };
    const Throwing = createThrowingComponent(flag);
    render(
      <TestErrorBoundary errorComponent={ErrorPage}>
        <Throwing />
      </TestErrorBoundary>
    );

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(document.activeElement).toBe(main);
  });

  it("restores document.title when boundary unmounts while still in error state", () => {
    document.title = "Dashboard | The Magic Lab";
    const flag = { current: true };
    const Throwing = createThrowingComponent(flag);
    const { unmount } = render(
      <TestErrorBoundary errorComponent={ErrorPage}>
        <Throwing />
      </TestErrorBoundary>
    );

    expect(document.title).toBe("errors.pageTitle");
    unmount();
    expect(document.title).toBe("Dashboard | The Magic Lab");
  });

  it("handles error with digest property through boundary", () => {
    function DigestThrower(): ReactElement {
      throw Object.assign(new Error("digest error"), {
        digest: "NEXT_DIGEST_abc",
      });
    }

    render(
      <TestErrorBoundary errorComponent={ErrorPage}>
        <DigestThrower />
      </TestErrorBoundary>
    );

    expect(
      screen.getByRole("heading", { name: "errors.somethingWrong" })
    ).toBeInTheDocument();
  });

  it("logs error to console when boundary catches", () => {
    const flag = { current: true };
    const Throwing = createThrowingComponent(flag);
    render(
      <TestErrorBoundary errorComponent={ErrorPage}>
        <Throwing />
      </TestErrorBoundary>
    );

    expect(console.error).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Simulated render error" })
    );
  });
});
