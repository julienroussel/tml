import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RepertoireCard } from "./repertoire-card";

const { mockUseTrickCount } = vi.hoisted(() => ({
  mockUseTrickCount: vi.fn(),
}));

vi.mock("@/features/repertoire/hooks/use-trick-count", () => ({
  useTrickCount: mockUseTrickCount,
}));

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

const DESCRIPTION_RE = /dashboard\.repertoireDescription/u;

function mockHook({
  count = 0,
  isLoading = false,
  error = null,
}: {
  count?: number;
  isLoading?: boolean;
  error?: Error | null;
} = {}): void {
  mockUseTrickCount.mockReturnValue({ count, isLoading, error });
}

describe("RepertoireCard", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // suppress expected error logs from the error-state test
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("renders a link to /repertoire", () => {
    mockHook({ count: 5 });
    render(<RepertoireCard />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/repertoire");
  });

  it("sets an accessible label on the link", () => {
    mockHook({ count: 5 });
    render(<RepertoireCard />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "aria-label",
      "dashboard.repertoireLink"
    );
  });

  it("displays the repertoire title", () => {
    mockHook({ count: 5 });
    render(<RepertoireCard />);
    expect(screen.getByText("dashboard.repertoireTitle")).toBeInTheDocument();
  });

  it("displays the trick count description when the count resolves", () => {
    mockHook({ count: 0 });
    render(<RepertoireCard />);
    expect(screen.getByText(DESCRIPTION_RE)).toBeInTheDocument();
  });

  it("marks the description as busy and hides the count while loading", () => {
    mockHook({ count: 0, isLoading: true });
    const { container } = render(<RepertoireCard />);
    expect(screen.queryByText(DESCRIPTION_RE)).not.toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("falls back to an em-dash on hook error and does NOT render the count", () => {
    mockHook({ count: 0, error: new Error("query failed") });
    const { container } = render(<RepertoireCard />);
    expect(screen.queryByText(DESCRIPTION_RE)).not.toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it("logs an error to the console on hook error", () => {
    const err = new Error("query failed");
    mockHook({ count: 0, error: err });
    render(<RepertoireCard />);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "RepertoireCard: failed to load trick count",
      err
    );
  });

  it("does not mark the description as busy when the count resolves", () => {
    mockHook({ count: 5 });
    const { container } = render(<RepertoireCard />);
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });
});
