import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TrickId } from "@/db/types";
import type { ParsedTrick } from "../types";
import { TrickFormSheet } from "./trick-form-sheet";

// Mock TrickForm to avoid rendering the full react-hook-form + comboboxes
vi.mock("./trick-form", () => ({
  TrickForm: ({ formId }: { formId: string }) => (
    <form data-testid="trick-form" id={formId} />
  ),
}));

// Mock ScrollArea to render children directly
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const baseTrick: ParsedTrick = {
  id: "trick-1" as TrickId,
  name: "Card Warp",
  status: "new",
  difficulty: 3,
  category: "Cards",
  description: null,
  effectType: null,
  duration: null,
  performanceType: null,
  angleSensitivity: null,
  props: null,
  music: null,
  languages: [],
  isCameraFriendly: null,
  isSilent: null,
  notes: null,
  source: null,
  videoUrl: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const defaultProps = {
  availableTags: [],
  categories: [],
  effectTypes: [],
  onCreateTag: vi.fn(),
  onOpenChange: vi.fn(),
  onSubmit: vi.fn(),
  onToggleTag: vi.fn(),
  open: true,
  selectedTagIds: [],
  trick: null,
};

describe("TrickFormSheet", () => {
  it("renders without crashing when open with no trick (add mode)", () => {
    render(<TrickFormSheet {...defaultProps} />);
    expect(screen.getByText("repertoire.addTrick")).toBeInTheDocument();
  });

  it("renders in edit mode when a trick is provided", () => {
    render(<TrickFormSheet {...defaultProps} trick={baseTrick} />);
    expect(screen.getByText("repertoire.editTrick")).toBeInTheDocument();
  });

  it("renders Cancel and Save buttons", () => {
    render(<TrickFormSheet {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "repertoire.cancel" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "repertoire.save" })
    ).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when Cancel is clicked with no unsaved changes", async () => {
    const onOpenChange = vi.fn();
    render(<TrickFormSheet {...defaultProps} onOpenChange={onOpenChange} />);
    await userEvent.click(
      screen.getByRole("button", { name: "repertoire.cancel" })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not render sheet content when closed", () => {
    render(<TrickFormSheet {...defaultProps} open={false} />);
    expect(screen.queryByText("repertoire.addTrick")).not.toBeInTheDocument();
  });

  it("disables save button when submitting", () => {
    render(<TrickFormSheet {...defaultProps} submitting={true} />);
    expect(
      screen.getByRole("button", { name: "repertoire.save" })
    ).toBeDisabled();
  });

  it("save button is enabled when not submitting", () => {
    render(<TrickFormSheet {...defaultProps} submitting={false} />);
    expect(
      screen.getByRole("button", { name: "repertoire.save" })
    ).not.toBeDisabled();
  });

  it("renders the trick form", () => {
    render(<TrickFormSheet {...defaultProps} />);
    expect(screen.getByTestId("trick-form")).toBeInTheDocument();
  });
});
