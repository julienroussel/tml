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
    // (the same useTrick result drives both), so render that realistic combo.
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
    // Persistent live region announces loading state via text content
    // (issue #288 F3).
    expect(screen.getByRole("status")).toHaveTextContent(
      "repertoire.loadingTrick"
    );
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

// ---------------------------------------------------------------------------
// Persistent aria-live region (issue #288 F3) — owns the loading→ready
// announcement so screen readers don't fall silent when the skeleton unmounts
// on transition to the edit form. WCAG 2.2 SC 4.1.3 (Status Messages).
// ---------------------------------------------------------------------------
describe("TrickFormSheet live region (issue #288 F3)", () => {
  function getLiveRegion(): HTMLElement {
    return screen.getByRole("status");
  }

  it("renders the persistent live region with correct attributes in loading mode", () => {
    render(<TrickFormSheet {...defaultProps} mode={{ mode: "loading" }} />);

    const region = getLiveRegion();
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
    expect(region).toHaveClass("sr-only");
    expect(region).toHaveTextContent("repertoire.loadingTrick");
  });

  it("renders the live region with the ready message in edit mode", () => {
    render(
      <TrickFormSheet
        {...defaultProps}
        mode={{ mode: "edit", trick: baseTrick }}
      />
    );

    const region = getLiveRegion();
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
    expect(region).toHaveClass("sr-only");
    expect(region).toHaveTextContent("repertoire.trickReady");
  });

  it("renders the live region empty in create mode (no spurious announcement)", () => {
    render(<TrickFormSheet {...defaultProps} mode={{ mode: "create" }} />);

    // The region exists but has no text content — screen readers won't
    // announce anything when the Add sheet opens.
    const region = getLiveRegion();
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
    expect(region).toHaveClass("sr-only");
    expect(region).toHaveTextContent("");
  });

  it("does not duplicate role=status on the skeleton wrapper (single source of truth)", () => {
    render(<TrickFormSheet {...defaultProps} mode={{ mode: "loading" }} />);

    // Only one status element — the persistent live region. The skeleton
    // wrapper does NOT carry a competing role=status (would cause
    // double-announcement); the persistent live region owns the
    // loading-state announcement on its own.
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("marks the skeleton container aria-busy=true so AT treats it as in-progress (not the live region's parent)", () => {
    render(<TrickFormSheet {...defaultProps} mode={{ mode: "loading" }} />);

    // The skeleton container — NOT its parent — owns aria-busy. The live
    // region span is a sibling so its polite announcement isn't deferred by
    // an aria-busy ancestor (ARIA 1.2 lets AT skip mutations inside busy
    // regions). Anchoring on the live region's nextElementSibling
    // disambiguates from the Save button, which also declares aria-busy.
    const liveRegion = screen.getByRole("status");
    const skeletonContainer = liveRegion.nextElementSibling;
    expect(skeletonContainer).toHaveAttribute("aria-busy", "true");
  });

  it("does not put aria-busy on the form region's wrapper in edit mode (avoids suppressing live region)", () => {
    render(
      <TrickFormSheet
        {...defaultProps}
        mode={{ mode: "edit", trick: baseTrick }}
      />
    );

    // In edit mode the next sibling is the form (no aria-busy). The wrapper
    // <div> that contains the live region must NOT carry aria-busy=true
    // either — that would suppress the live region's polite announcement
    // per ARIA 1.2.
    const liveRegion = screen.getByRole("status");
    const sibling = liveRegion.nextElementSibling;
    expect(sibling).not.toHaveAttribute("aria-busy", "true");
    expect(liveRegion.parentElement).not.toHaveAttribute("aria-busy", "true");
  });

  it("preserves the live region node across the loading → edit transition", () => {
    const { rerender } = render(
      <TrickFormSheet {...defaultProps} mode={{ mode: "loading" }} />
    );
    const loadingRegion = getLiveRegion();
    expect(loadingRegion).toHaveTextContent("repertoire.loadingTrick");

    rerender(
      <TrickFormSheet
        {...defaultProps}
        mode={{ mode: "edit", trick: baseTrick }}
      />
    );
    const readyRegion = getLiveRegion();

    // Same DOM node — aria-live announces the content change without the
    // region unmounting + remounting (which would risk re-announcing the
    // initial loading text or being skipped entirely on some screen readers).
    expect(readyRegion).toBe(loadingRegion);
    expect(readyRegion).toHaveTextContent("repertoire.trickReady");
  });

  it("preserves the live region node across edit(A) → loading → edit(B) (target switch mid-edit)", () => {
    const trickA: ParsedTrick = {
      ...baseTrick,
      id: "trick-a" as TrickId,
      name: "First",
    };
    const trickB: ParsedTrick = {
      ...baseTrick,
      id: "trick-b" as TrickId,
      name: "Second",
    };
    const { rerender } = render(
      <TrickFormSheet
        {...defaultProps}
        mode={{ mode: "edit", trick: trickA }}
      />
    );
    const initialRegion = getLiveRegion();

    rerender(<TrickFormSheet {...defaultProps} mode={{ mode: "loading" }} />);
    expect(getLiveRegion()).toBe(initialRegion);

    rerender(
      <TrickFormSheet
        {...defaultProps}
        mode={{ mode: "edit", trick: trickB }}
      />
    );
    const finalRegion = getLiveRegion();

    // Same DOM node across all three modes — the persistent span is structurally
    // a sibling of the loading/form conditional in the parent, so target swaps
    // (and the form-key remount that accompanies them in production) cannot
    // unmount it. (The mocked TrickForm here doesn't honor `key`; this test
    // locks the parent's render structure, not the key-remount mechanism.)
    expect(finalRegion).toBe(initialRegion);
    expect(finalRegion).toHaveTextContent("repertoire.trickReady");
  });

  it("preserves the live region node across edit → create (reset path)", () => {
    const { rerender } = render(
      <TrickFormSheet
        {...defaultProps}
        mode={{ mode: "edit", trick: baseTrick }}
      />
    );
    const editRegion = getLiveRegion();

    rerender(<TrickFormSheet {...defaultProps} mode={{ mode: "create" }} />);
    const createRegion = getLiveRegion();

    expect(createRegion).toBe(editRegion);
    // Create mode renders empty — no spurious announcement on transition.
    expect(createRegion).toHaveTextContent("");
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

  it("closes an orphaned discard dialog when the sheet is force-closed via prop", async () => {
    // External force-close paths (settledMissing toast, load-error toast,
    // programmatic close) drive `open=false` as a prop rather than routing
    // through the Sheet's onOpenChange interceptor. Without the cleanup
    // effect in TrickFormSheet, the AlertDialog (a Fragment sibling of the
    // Sheet) would remain mounted over a torn-down sheet.
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <TrickFormSheet
        {...defaultProps}
        onOpenChange={onOpenChange}
        tagsDirty={true}
      />
    );

    // Pop the discard dialog open by clicking Cancel with dirty tags.
    await userEvent.click(
      screen.getByRole("button", { name: "repertoire.cancel" })
    );
    expect(screen.getByTestId("discard-dialog")).toBeInTheDocument();

    // Parent flips `open` to false directly (bypassing the Sheet's
    // onOpenChange interceptor). The cleanup effect must close the dialog.
    rerender(
      <TrickFormSheet
        {...defaultProps}
        onOpenChange={onOpenChange}
        open={false}
        tagsDirty={true}
      />
    );

    expect(screen.queryByTestId("discard-dialog")).not.toBeInTheDocument();
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
