import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockUseItemCount } = vi.hoisted(() => ({
  mockUseItemCount: vi.fn(),
}));

vi.mock("@/features/collect/hooks/use-item-count", () => ({
  useItemCount: mockUseItemCount,
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

import { CollectionCard } from "./collection-card";

const DESCRIPTION_RE = /dashboard\.collectionDescription/;

function mockHook({
  count = 0,
  isLoading = false,
  error = null,
}: {
  count?: number;
  isLoading?: boolean;
  error?: Error | null;
} = {}): void {
  mockUseItemCount.mockReturnValue({ count, isLoading, error });
}

describe("CollectionCard", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // suppress expected error logs from the error-state test
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("renders a link to /collect", () => {
    mockHook({ count: 5 });
    render(<CollectionCard />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/collect");
  });

  it("sets an accessible label on the link", () => {
    mockHook({ count: 5 });
    render(<CollectionCard />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "aria-label",
      "dashboard.collectionLink"
    );
  });

  it("displays the collection title", () => {
    mockHook({ count: 5 });
    render(<CollectionCard />);
    expect(screen.getByText("dashboard.collectionTitle")).toBeInTheDocument();
  });

  it("displays the item count description when the count resolves", () => {
    mockHook({ count: 0 });
    render(<CollectionCard />);
    expect(screen.getByText(DESCRIPTION_RE)).toBeInTheDocument();
  });

  it("marks the description as busy and hides the count while loading", () => {
    mockHook({ count: 0, isLoading: true });
    const { container } = render(<CollectionCard />);
    expect(screen.queryByText(DESCRIPTION_RE)).not.toBeInTheDocument();
    // aria-busy is the stable accessibility-tree signal; coupling tests to it
    // (rather than the shadcn `data-slot="skeleton"` attribute) means a shadcn
    // primitive bump can't silently break these tests.
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("falls back to an em-dash on hook error and does NOT render the count", () => {
    mockHook({ count: 0, error: new Error("query failed") });
    const { container } = render(<CollectionCard />);
    expect(screen.queryByText(DESCRIPTION_RE)).not.toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    // Em-dash branch must not also render a skeleton — the loading state and
    // the error state are mutually exclusive.
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it("logs an error to the console on hook error", () => {
    const err = new Error("query failed");
    mockHook({ count: 0, error: err });
    render(<CollectionCard />);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "CollectionCard: failed to load item count",
      err
    );
  });

  it("does not mark the description as busy when the count resolves", () => {
    mockHook({ count: 5 });
    const { container } = render(<CollectionCard />);
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });
});
