import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrickId } from "@/db/types";
import type { ParsedTrick } from "../types";
import type { TrickFormProps } from "./trick-form";
import { TrickFormSheet } from "./trick-form-sheet";

// Capture the props passed to TrickForm so tests can drive onDirtyChange.
const capturedTrickFormProps = vi.fn();
const capturedSheetOnOpenChange = vi.fn();
// Holds the AlertDialog's onOpenChange so the mocked AlertDialogCancel can
// invoke it (mirrors Radix's behavior where Cancel closes the dialog).
const capturedAlertDialogOnOpenChange = vi.fn();

// Mock TrickForm to avoid rendering the full react-hook-form + comboboxes
vi.mock("./trick-form", () => ({
  TrickForm: (
    props: Pick<TrickFormProps, "formId" | "onDirtyChange" | "onSubmit">
  ) => {
    capturedTrickFormProps(props);
    return (
      <form data-testid="trick-form" id={props.formId}>
        <button
          data-testid="make-dirty"
          onClick={() => props.onDirtyChange?.(true)}
          type="button"
        />
      </form>
    );
  },
}));

// Sheet/AlertDialog mocks: Radix Dialog renders into a portal which jsdom
// handles inconsistently for our use case (we need to assert on the Sheet's
// onOpenChange callback firing in response to escape/click-outside without
// rendering the full Radix overlay tree). The capturedSheetOnOpenChange
// pattern lets tests simulate Radix invoking onOpenChange directly.
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({
    children,
    open,
    onOpenChange,
  }: {
    children: ReactNode;
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => {
    if (onOpenChange) {
      capturedSheetOnOpenChange.mockImplementation(onOpenChange);
    }
    return open ? <div data-testid="sheet">{children}</div> : null;
  },
  SheetContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="sheet-content">{children}</div>
  ),
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SheetFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

// AlertDialog mock: the real Radix AlertDialog handles its own open state via
// onOpenChange when the user clicks the AlertDialogCancel — we approximate by
// capturing the AlertDialog's onOpenChange in a module-level fn and invoking
// it from the AlertDialogCancel mock. This lets tests verify that clicking
// Cancel closes the dialog WITHOUT invoking the parent's onOpenChange handler.
vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: ReactNode;
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => {
    if (onOpenChange) {
      capturedAlertDialogOnOpenChange.mockImplementation(onOpenChange);
    }
    return open ? <div data-testid="discard-dialog">{children}</div> : null;
  },
  AlertDialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogCancel: ({ children }: { children: ReactNode }) => (
    <button
      data-testid="discard-cancel"
      onClick={() => capturedAlertDialogOnOpenChange(false)}
      type="button"
    >
      {children}
    </button>
  ),
  AlertDialogAction: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => (
    <button data-testid="discard-confirm" onClick={onClick} type="button">
      {children}
    </button>
  ),
}));

// Mock ScrollArea to render children directly
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
  mode: { mode: "create" as const },
};

describe("TrickFormSheet", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing when open with no trick (add mode)", () => {
    render(<TrickFormSheet {...defaultProps} />);
    expect(screen.getByText("repertoire.addTrick")).toBeInTheDocument();
  });

  it("renders in edit mode when a trick is provided", () => {
    render(
      <TrickFormSheet
        {...defaultProps}
        mode={{ mode: "edit", trick: baseTrick }}
      />
    );
    expect(screen.getByText("repertoire.editTrick")).toBeInTheDocument();
  });

  it("shows the edit title and a skeleton body while the edit target loads", () => {
    // In production, mode:"loading" always coincides with relationsLoading:true
    // (the same editingTrickLoading drives both), so render that realistic combo.
    render(
      <TrickFormSheet
        {...defaultProps}
        mode={{ mode: "loading" }}
        relationsLoading={true}
      />
    );

    expect(screen.getByText("repertoire.editTrick")).toBeInTheDocument();
    expect(screen.queryByText("repertoire.addTrick")).not.toBeInTheDocument();
    expect(screen.queryByTestId("trick-form")).not.toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "repertoire.loadingTrick" })
    ).toBeInTheDocument();
    // Save stays disabled while the edit target loads — no submit against an
    // unmounted form.
    expect(
      screen.getByRole("button", { name: "repertoire.save" })
    ).toBeDisabled();
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

  it("save button is enabled by default (idle submit state)", () => {
    render(<TrickFormSheet {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "repertoire.save" })
    ).not.toBeDisabled();
  });

  it("disables the save button while the parent onSubmit is pending", async () => {
    // Internal isSubmitting state (managed by handleFormSubmit) drives Save's
    // disabled flag — drive a never-resolving onSubmit to observe the mid-flight
    // state, then resolve to verify it re-enables.
    let resolveSubmit!: () => void;
    const onSubmit = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        })
    );

    render(<TrickFormSheet {...defaultProps} onSubmit={onSubmit} />);

    const captured = capturedTrickFormProps.mock.calls[0]?.[0] as
      | { onSubmit?: (data: unknown) => Promise<void> }
      | undefined;
    if (!captured?.onSubmit) {
      throw new Error("Expected TrickForm to receive an onSubmit handler");
    }

    // Fire-and-forget the submit so the assertion runs mid-flight.
    let submitPromise: Promise<void> | undefined;
    act(() => {
      submitPromise = captured.onSubmit?.({ name: "Test" });
    });

    expect(
      screen.getByRole("button", { name: "repertoire.save" })
    ).toBeDisabled();

    await act(async () => {
      resolveSubmit();
      await submitPromise;
    });

    expect(
      screen.getByRole("button", { name: "repertoire.save" })
    ).not.toBeDisabled();
  });

  it("renders the trick form", () => {
    render(<TrickFormSheet {...defaultProps} />);
    expect(screen.getByTestId("trick-form")).toBeInTheDocument();
  });
});

describe("unsaved changes guard", () => {
  it("calls onOpenChange(false) when cancel is clicked and the form is clean", async () => {
    const onOpenChange = vi.fn();
    render(<TrickFormSheet {...defaultProps} onOpenChange={onOpenChange} />);

    await userEvent.click(
      screen.getByRole("button", { name: "repertoire.cancel" })
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId("discard-dialog")).not.toBeInTheDocument();
  });

  it("shows the discard dialog when cancel is clicked with dirty tags", async () => {
    const onOpenChange = vi.fn();
    render(
      <TrickFormSheet
        {...defaultProps}
        onOpenChange={onOpenChange}
        tagsDirty={true}
      />
    );

    await userEvent.click(
      screen.getByRole("button", { name: "repertoire.cancel" })
    );

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByTestId("discard-dialog")).toBeInTheDocument();
  });

  it("shows the discard dialog when cancel is clicked while formDirty is true and tagsDirty is false", async () => {
    const onOpenChange = vi.fn();
    render(
      <TrickFormSheet
        {...defaultProps}
        onOpenChange={onOpenChange}
        tagsDirty={false}
      />
    );

    await userEvent.click(screen.getByTestId("make-dirty"));
    await userEvent.click(
      screen.getByRole("button", { name: "repertoire.cancel" })
    );

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByTestId("discard-dialog")).toBeInTheDocument();
  });

  it("closes the sheet when discard is confirmed with a dirty form", async () => {
    const onOpenChange = vi.fn();
    render(
      <TrickFormSheet
        {...defaultProps}
        onOpenChange={onOpenChange}
        tagsDirty={true}
      />
    );

    // Open the discard dialog via the cancel button, then confirm.
    await userEvent.click(
      screen.getByRole("button", { name: "repertoire.cancel" })
    );
    await userEvent.click(screen.getByTestId("discard-confirm"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("leaves the sheet open when the discard dialog's cancel is clicked", async () => {
    const onOpenChange = vi.fn();
    render(
      <TrickFormSheet
        {...defaultProps}
        onOpenChange={onOpenChange}
        tagsDirty={true}
      />
    );

    await userEvent.click(
      screen.getByRole("button", { name: "repertoire.cancel" })
    );
    expect(screen.getByTestId("discard-dialog")).toBeInTheDocument();

    // Click the AlertDialogCancel inside the discard dialog.
    await userEvent.click(screen.getByTestId("discard-cancel"));

    // The parent's onOpenChange must NOT be called with false — the sheet stays.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByTestId("sheet")).toBeInTheDocument();
  });

  // The Sheet's own onOpenChange fires on escape key / click-outside. With a
  // dirty form it must route through the discard dialog instead of closing.
  describe("Sheet-driven close (escape / click-outside)", () => {
    it("shows the discard dialog when Sheet onOpenChange(false) fires while tags are dirty", () => {
      const onOpenChange = vi.fn();
      render(
        <TrickFormSheet
          {...defaultProps}
          onOpenChange={onOpenChange}
          tagsDirty={true}
        />
      );

      act(() => {
        capturedSheetOnOpenChange(false);
      });

      expect(onOpenChange).not.toHaveBeenCalledWith(false);
      expect(screen.getByTestId("discard-dialog")).toBeInTheDocument();
    });

    it("shows the discard dialog when Sheet onOpenChange(false) fires while formDirty is true", async () => {
      const onOpenChange = vi.fn();
      render(
        <TrickFormSheet
          {...defaultProps}
          onOpenChange={onOpenChange}
          tagsDirty={false}
        />
      );

      await userEvent.click(screen.getByTestId("make-dirty"));
      act(() => {
        capturedSheetOnOpenChange(false);
      });

      expect(onOpenChange).not.toHaveBeenCalledWith(false);
      expect(screen.getByTestId("discard-dialog")).toBeInTheDocument();
    });

    it("calls onOpenChange(false) when Sheet onOpenChange(false) fires while the form is clean", () => {
      const onOpenChange = vi.fn();
      render(<TrickFormSheet {...defaultProps} onOpenChange={onOpenChange} />);

      act(() => {
        capturedSheetOnOpenChange(false);
      });

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(screen.queryByTestId("discard-dialog")).not.toBeInTheDocument();
    });

    it("closes the sheet when discard is confirmed after a Sheet-driven close attempt", async () => {
      const onOpenChange = vi.fn();
      render(
        <TrickFormSheet
          {...defaultProps}
          onOpenChange={onOpenChange}
          tagsDirty={true}
        />
      );

      act(() => {
        capturedSheetOnOpenChange(false);
      });
      expect(screen.getByTestId("discard-dialog")).toBeInTheDocument();

      await userEvent.click(screen.getByTestId("discard-confirm"));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
