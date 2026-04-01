import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TrickEmptyState } from "./trick-empty-state";

describe("TrickEmptyState", () => {
  it("renders the title text", () => {
    render(<TrickEmptyState onAddTrick={vi.fn()} />);
    // Global mock returns "repertoire.emptyTitle" (namespace.key)
    expect(screen.getByText("repertoire.emptyTitle")).toBeInTheDocument();
  });

  it("renders the description text", () => {
    render(<TrickEmptyState onAddTrick={vi.fn()} />);
    expect(screen.getByText("repertoire.emptyDescription")).toBeInTheDocument();
  });

  it("renders the CTA button", () => {
    render(<TrickEmptyState onAddTrick={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "repertoire.addTrick" })
    ).toBeInTheDocument();
  });

  it("calls onAddTrick when CTA button is clicked", async () => {
    const onAddTrick = vi.fn();
    render(<TrickEmptyState onAddTrick={onAddTrick} />);

    await userEvent.click(
      screen.getByRole("button", { name: "repertoire.addTrick" })
    );

    expect(onAddTrick).toHaveBeenCalledOnce();
  });

  it("does not call onAddTrick before button is clicked", () => {
    const onAddTrick = vi.fn();
    render(<TrickEmptyState onAddTrick={onAddTrick} />);
    expect(onAddTrick).not.toHaveBeenCalled();
  });
});
