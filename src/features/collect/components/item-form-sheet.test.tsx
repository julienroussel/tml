import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ItemId, TagId } from "@/db/types";
import type { ParsedItem } from "../types";
import { ItemFormSheet, type ItemFormSheetProps } from "./item-form-sheet";

// Capture the props passed to ItemForm so we can assert on toFormDefaults output
const capturedItemFormProps = vi.fn();
const capturedSheetOnOpenChange = vi.fn();
// Holds the AlertDialog's onOpenChange so the mocked AlertDialogCancel can
// invoke it (mirrors Radix's behavior where Cancel closes the dialog).
const capturedAlertDialogOnOpenChange = vi.fn();

vi.mock("./item-form", () => ({
  ItemForm: (props: Record<string, unknown>) => {
    capturedItemFormProps(props);
    return <div data-testid="item-form" />;
  },
}));

// Sheet/AlertDialog mocks: Radix Dialog renders into a portal which jsdom
// handles inconsistently for our use case (we need to assert on the Sheet's
// onOpenChange callback firing in response to escape/click-outside without
// rendering the full Radix overlay tree). The capturedSheetOnOpenChange
// pattern lets tests simulate Radix invoking onOpenChange directly.
// If we ever migrate to the trick-form-sheet pattern (real Radix +
// flushRadixTimers + pointerDown overlay), this mock can be removed.
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
  SheetContent: ({
    children,
    onEscapeKeyDown,
    onInteractOutside,
  }: {
    children: ReactNode;
    onEscapeKeyDown?: (e: Event) => void;
    onInteractOutside?: (e: Event) => void;
  }) => (
    <div
      data-escape={onEscapeKeyDown ? "bound" : undefined}
      data-interact-outside={onInteractOutside ? "bound" : undefined}
      data-testid="sheet-content"
    >
      {children}
    </div>
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

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    type,
    disabled,
    ...rest
  }: {
    children: ReactNode;
    onClick?: () => void;
    type?: string;
    form?: string;
    variant?: string;
    disabled?: boolean;
  }) => (
    <button
      data-variant={rest.variant}
      disabled={disabled}
      onClick={onClick}
      type={type as "button" | "submit"}
    >
      {children}
    </button>
  ),
}));

function defaultProps(
  overrides?: Partial<ItemFormSheetProps>
): ItemFormSheetProps {
  return {
    availableTags: [],
    availableTricks: [],
    mode: { mode: "create" },
    onCreateTag: vi.fn().mockResolvedValue("tag-1" as TagId),
    onOpenChange: vi.fn(),
    onSubmit: vi.fn(),
    onToggleTag: vi.fn(),
    onToggleTrick: vi.fn(),
    open: true,
    selectedTagIds: [],
    selectedTrickIds: [],
    userBrands: [],
    userLocations: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

/** Extract the defaultValues prop passed to the mocked ItemForm. */
function getFormDefaults(): Record<string, unknown> | undefined {
  const call = capturedItemFormProps.mock.calls[0] as
    | [Record<string, unknown>]
    | undefined;
  return call?.[0]?.defaultValues as Record<string, unknown> | undefined;
}

describe("toFormDefaults (via ItemFormSheet)", () => {
  it("converts a fully populated ParsedItem to form defaults", () => {
    const item: ParsedItem = {
      id: "item-full" as ItemId,
      name: "Invisible Deck",
      type: "deck",
      description: "A classic mentalism prop",
      brand: "Bicycle",
      condition: "new",
      location: "Close-up case",
      notes: "Keep dry",
      purchaseDate: "2025-01-15",
      purchasePrice: 29.99,
      quantity: 2,
      creator: "Bob Ostin",
      url: "https://example.com/deck",
      createdAt: "2025-01-15T12:00:00.000Z",
      updatedAt: "2025-01-15T12:00:00.000Z",
    };

    render(
      <ItemFormSheet {...defaultProps({ mode: { mode: "edit", item } })} />
    );

    expect(capturedItemFormProps).toHaveBeenCalled();
    const defaultValues = getFormDefaults();
    expect(defaultValues).toEqual({
      brand: "Bicycle",
      condition: "new",
      creator: "Bob Ostin",
      description: "A classic mentalism prop",
      location: "Close-up case",
      name: "Invisible Deck",
      notes: "Keep dry",
      purchaseDate: "2025-01-15",
      purchasePrice: "29.99",
      quantity: 2,
      type: "deck",
      url: "https://example.com/deck",
    });
  });

  it("converts a minimal ParsedItem with null optionals to empty strings", () => {
    const item: ParsedItem = {
      id: "item-1" as ParsedItem["id"],
      name: "Simple Prop",
      type: "prop",
      description: null,
      brand: null,
      condition: null,
      location: null,
      notes: null,
      purchaseDate: null,
      purchasePrice: null,
      quantity: 1,
      creator: null,
      url: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };

    render(
      <ItemFormSheet {...defaultProps({ mode: { mode: "edit", item } })} />
    );

    const defaultValues = getFormDefaults();
    expect(defaultValues).toEqual({
      brand: "",
      condition: null,
      creator: "",
      description: "",
      location: "",
      name: "Simple Prop",
      notes: "",
      purchaseDate: "",
      purchasePrice: "",
      quantity: 1,
      type: "prop",
      url: "",
    });
  });

  it("converts purchasePrice of 0 to the string '0'", () => {
    const item: ParsedItem = {
      id: "item-2" as ParsedItem["id"],
      name: "Free Sample",
      type: "prop",
      description: null,
      brand: null,
      condition: "good",
      location: null,
      notes: null,
      purchaseDate: null,
      purchasePrice: 0,
      quantity: 1,
      creator: null,
      url: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };

    render(
      <ItemFormSheet {...defaultProps({ mode: { mode: "edit", item } })} />
    );

    const defaultValues = getFormDefaults();
    expect(defaultValues?.purchasePrice).toBe("0");
  });

  it("passes undefined defaultValues when item is null (create mode)", () => {
    render(<ItemFormSheet {...defaultProps({ mode: { mode: "create" } })} />);

    const defaultValues = getFormDefaults();
    expect(defaultValues).toBeUndefined();
  });

  it("converts empty-string optional fields from ParsedItem", () => {
    const item: ParsedItem = {
      id: "item-3" as ParsedItem["id"],
      name: "Blank Fields",
      type: "book",
      description: "",
      brand: "",
      condition: "worn",
      location: "",
      notes: "",
      purchaseDate: "",
      purchasePrice: null,
      quantity: 0,
      creator: "",
      url: "",
      createdAt: "2025-02-01T00:00:00.000Z",
      updatedAt: "2025-02-01T00:00:00.000Z",
    };

    render(
      <ItemFormSheet {...defaultProps({ mode: { mode: "edit", item } })} />
    );

    const defaultValues = getFormDefaults();
    expect(defaultValues?.description).toBe("");
    expect(defaultValues?.brand).toBe("");
    expect(defaultValues?.quantity).toBe(0);
    expect(defaultValues?.purchasePrice).toBe("");
  });
});

describe("ItemFormSheet rendering", () => {
  it("does not render when open is false", () => {
    render(<ItemFormSheet {...defaultProps({ open: false })} />);

    expect(screen.queryByTestId("sheet")).not.toBeInTheDocument();
  });

  it("renders the sheet when open is true", () => {
    render(<ItemFormSheet {...defaultProps({ open: true })} />);

    expect(screen.getByTestId("sheet")).toBeInTheDocument();
    expect(screen.getByTestId("item-form")).toBeInTheDocument();
  });

  it("shows 'add' title when item is null", () => {
    render(<ItemFormSheet {...defaultProps({ mode: { mode: "create" } })} />);

    expect(screen.getByText("collect.addItem")).toBeInTheDocument();
  });

  it("shows 'edit' title when item is provided", () => {
    const item: ParsedItem = {
      id: "item-edit" as ParsedItem["id"],
      name: "Editing",
      type: "prop",
      description: null,
      brand: null,
      condition: null,
      location: null,
      notes: null,
      purchaseDate: null,
      purchasePrice: null,
      quantity: 1,
      creator: null,
      url: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };

    render(
      <ItemFormSheet {...defaultProps({ mode: { mode: "edit", item } })} />
    );

    expect(screen.getByText("collect.editItem")).toBeInTheDocument();
  });

  it("shows the edit title and a skeleton body while the edit target loads", () => {
    // In production, mode:"loading" always coincides with relationsLoading:true
    // (the same useItem result drives both), so render that realistic combo.
    render(
      <ItemFormSheet
        {...defaultProps({ mode: { mode: "loading" }, relationsLoading: true })}
      />
    );

    // Title reflects edit *intent*, not loaded data — must not flip to "add".
    expect(screen.getByText("collect.editItem")).toBeInTheDocument();
    expect(screen.queryByText("collect.addItem")).not.toBeInTheDocument();
    // The form is not mounted while loading; the persistent live region
    // announces the loading state via text content (issue #288 F3).
    expect(screen.queryByTestId("item-form")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("collect.loadingItem");
    // Save stays disabled while the edit target loads — no submit against an
    // unmounted form.
    expect(screen.getByRole("button", { name: "collect.save" })).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Persistent aria-live region (issue #288 F3) — owns the loading→ready
// announcement so screen readers don't fall silent when the skeleton unmounts
// on transition to the edit form. WCAG 2.2 SC 4.1.3 (Status Messages).
// ---------------------------------------------------------------------------
describe("ItemFormSheet live region (issue #288 F3)", () => {
  function getLiveRegion(): HTMLElement {
    return screen.getByRole("status");
  }

  it("renders the persistent live region with correct attributes in loading mode", () => {
    render(<ItemFormSheet {...defaultProps({ mode: { mode: "loading" } })} />);

    const region = getLiveRegion();
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
    expect(region).toHaveClass("sr-only");
    expect(region).toHaveTextContent("collect.loadingItem");
  });

  it("renders the live region with the ready message in edit mode", () => {
    const item: ParsedItem = {
      id: "item-ready" as ItemId,
      name: "Loaded",
      type: "prop",
      description: null,
      brand: null,
      condition: null,
      location: null,
      notes: null,
      purchaseDate: null,
      purchasePrice: null,
      quantity: 1,
      creator: null,
      url: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
    render(
      <ItemFormSheet {...defaultProps({ mode: { mode: "edit", item } })} />
    );

    const region = getLiveRegion();
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
    expect(region).toHaveClass("sr-only");
    expect(region).toHaveTextContent("collect.itemReady");
  });

  it("renders the live region empty in create mode (no spurious announcement)", () => {
    render(<ItemFormSheet {...defaultProps({ mode: { mode: "create" } })} />);

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
    render(<ItemFormSheet {...defaultProps({ mode: { mode: "loading" } })} />);

    // Only one status element — the persistent live region. The skeleton
    // wrapper does NOT carry a competing role=status (would cause
    // double-announcement); the persistent live region owns the
    // loading-state announcement on its own.
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("marks the skeleton container aria-busy=true so AT treats it as in-progress (not the live region's parent)", () => {
    render(<ItemFormSheet {...defaultProps({ mode: { mode: "loading" } })} />);

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
    const item: ParsedItem = {
      id: "item-busy-edit" as ItemId,
      name: "Loaded",
      type: "prop",
      description: null,
      brand: null,
      condition: null,
      location: null,
      notes: null,
      purchaseDate: null,
      purchasePrice: null,
      quantity: 1,
      creator: null,
      url: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
    render(
      <ItemFormSheet {...defaultProps({ mode: { mode: "edit", item } })} />
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
      <ItemFormSheet {...defaultProps({ mode: { mode: "loading" } })} />
    );
    const loadingRegion = getLiveRegion();
    expect(loadingRegion).toHaveTextContent("collect.loadingItem");

    const item: ParsedItem = {
      id: "item-trans" as ItemId,
      name: "Settled",
      type: "prop",
      description: null,
      brand: null,
      condition: null,
      location: null,
      notes: null,
      purchaseDate: null,
      purchasePrice: null,
      quantity: 1,
      creator: null,
      url: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
    rerender(
      <ItemFormSheet {...defaultProps({ mode: { mode: "edit", item } })} />
    );
    const readyRegion = getLiveRegion();

    // Same DOM node — aria-live announces the content change without the
    // region unmounting + remounting (which would risk re-announcing the
    // initial loading text or being skipped entirely on some screen readers).
    expect(readyRegion).toBe(loadingRegion);
    expect(readyRegion).toHaveTextContent("collect.itemReady");
  });

  it("preserves the live region node across edit(A) → loading → edit(B) (target switch mid-edit)", () => {
    const makeItem = (id: string, name: string): ParsedItem => ({
      id: id as ItemId,
      name,
      type: "prop",
      description: null,
      brand: null,
      condition: null,
      location: null,
      notes: null,
      purchaseDate: null,
      purchasePrice: null,
      quantity: 1,
      creator: null,
      url: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });
    const itemA = makeItem("item-a", "First");
    const itemB = makeItem("item-b", "Second");
    const { rerender } = render(
      <ItemFormSheet
        {...defaultProps({ mode: { mode: "edit", item: itemA } })}
      />
    );
    const initialRegion = getLiveRegion();

    rerender(
      <ItemFormSheet {...defaultProps({ mode: { mode: "loading" } })} />
    );
    expect(getLiveRegion()).toBe(initialRegion);

    rerender(
      <ItemFormSheet
        {...defaultProps({ mode: { mode: "edit", item: itemB } })}
      />
    );
    const finalRegion = getLiveRegion();

    // Same DOM node across all three modes — the persistent span is structurally
    // a sibling of the loading/form conditional in the parent, so target swaps
    // (and the form-key remount that accompanies them in production) cannot
    // unmount it. (The mocked ItemForm here doesn't honor `key`; this test
    // locks the parent's render structure, not the key-remount mechanism.)
    expect(finalRegion).toBe(initialRegion);
    expect(finalRegion).toHaveTextContent("collect.itemReady");
  });

  it("preserves the live region node across edit → create (reset path)", () => {
    const item: ParsedItem = {
      id: "item-reset" as ItemId,
      name: "Existing",
      type: "prop",
      description: null,
      brand: null,
      condition: null,
      location: null,
      notes: null,
      purchaseDate: null,
      purchasePrice: null,
      quantity: 1,
      creator: null,
      url: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
    const { rerender } = render(
      <ItemFormSheet {...defaultProps({ mode: { mode: "edit", item } })} />
    );
    const editRegion = getLiveRegion();

    rerender(<ItemFormSheet {...defaultProps({ mode: { mode: "create" } })} />);
    const createRegion = getLiveRegion();

    expect(createRegion).toBe(editRegion);
    // Create mode renders empty — no spurious announcement on transition.
    expect(createRegion).toHaveTextContent("");
  });
});

describe("unsaved changes guard", () => {
  it("calls onOpenChange when cancel is clicked and form is clean", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(<ItemFormSheet {...defaultProps({ onOpenChange })} />);

    const cancelButton = screen.getByText("collect.cancel");
    await user.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows discard dialog when cancel is clicked with dirty tags", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <ItemFormSheet {...defaultProps({ onOpenChange, tagsDirty: true })} />
    );

    const cancelButton = screen.getByText("collect.cancel");
    await user.click(cancelButton);

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByTestId("discard-dialog")).toBeInTheDocument();
  });

  it("shows discard dialog when cancel is clicked with dirty tricks", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <ItemFormSheet {...defaultProps({ onOpenChange, tricksDirty: true })} />
    );

    const cancelButton = screen.getByText("collect.cancel");
    await user.click(cancelButton);

    expect(screen.getByTestId("discard-dialog")).toBeInTheDocument();
  });

  it("closes sheet when discard is confirmed", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <ItemFormSheet {...defaultProps({ onOpenChange, tagsDirty: true })} />
    );

    // Trigger the discard dialog via cancel button
    await user.click(screen.getByText("collect.cancel"));

    // Confirm discard
    const discardButton = screen.getByTestId("discard-confirm");
    await user.click(discardButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows discard dialog when Sheet onOpenChange fires while tags are dirty", () => {
    const onOpenChange = vi.fn();

    render(
      <ItemFormSheet {...defaultProps({ onOpenChange, tagsDirty: true })} />
    );

    // Simulate Escape key or click-outside — Sheet calls onOpenChange(false)
    act(() => {
      capturedSheetOnOpenChange(false);
    });

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByTestId("discard-dialog")).toBeInTheDocument();
  });

  it("shows discard dialog when Sheet onOpenChange fires while tricks are dirty", () => {
    const onOpenChange = vi.fn();

    render(
      <ItemFormSheet {...defaultProps({ onOpenChange, tricksDirty: true })} />
    );

    act(() => {
      capturedSheetOnOpenChange(false);
    });

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByTestId("discard-dialog")).toBeInTheDocument();
  });

  it("calls onOpenChange when Sheet onOpenChange fires while form is clean", () => {
    const onOpenChange = vi.fn();

    render(<ItemFormSheet {...defaultProps({ onOpenChange })} />);

    act(() => {
      capturedSheetOnOpenChange(false);
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId("discard-dialog")).not.toBeInTheDocument();
  });

  it("leaves sheet open when AlertDialogCancel inside discard dialog is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <ItemFormSheet {...defaultProps({ onOpenChange, tagsDirty: true })} />
    );

    // Open the discard dialog by clicking the sheet's cancel button
    await user.click(screen.getByText("collect.cancel"));
    expect(screen.getByTestId("discard-dialog")).toBeInTheDocument();

    // Click the AlertDialogCancel inside the discard dialog
    await user.click(screen.getByTestId("discard-cancel"));

    // The parent's onOpenChange must NOT be called with false
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    // The sheet (and its discard dialog) should still be open / not closed via parent
    expect(screen.getByTestId("sheet")).toBeInTheDocument();
  });

  it("closes an orphaned discard dialog when the sheet is force-closed via prop", async () => {
    // External force-close paths (settledMissing toast, load-error toast,
    // programmatic close) drive `open=false` as a prop rather than routing
    // through the Sheet's onOpenChange interceptor. Without the cleanup
    // effect in ItemFormSheet, the AlertDialog (a Fragment sibling of the
    // Sheet) would remain mounted over a torn-down sheet.
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    const { rerender } = render(
      <ItemFormSheet {...defaultProps({ onOpenChange, tagsDirty: true })} />
    );

    // Pop the discard dialog open by clicking Cancel with a dirty form.
    await user.click(screen.getByText("collect.cancel"));
    expect(screen.getByTestId("discard-dialog")).toBeInTheDocument();

    // Parent flips `open` to false directly (bypassing the Sheet's
    // onOpenChange interceptor). The cleanup effect must close the dialog.
    rerender(
      <ItemFormSheet
        {...defaultProps({ onOpenChange, tagsDirty: true, open: false })}
      />
    );

    expect(screen.queryByTestId("discard-dialog")).not.toBeInTheDocument();
  });
});

describe("handleFormSubmit", () => {
  /** Extract the onSubmit handler the sheet passed to the (mocked) ItemForm. */
  function getCapturedOnSubmit(): (data: unknown) => Promise<void> {
    const call = capturedItemFormProps.mock.calls[0] as
      | [Record<string, unknown>]
      | undefined;
    const handler = call?.[0]?.onSubmit;
    if (typeof handler !== "function") {
      throw new Error("Expected ItemForm to receive an onSubmit handler");
    }
    return handler as (data: unknown) => Promise<void>;
  }

  it("calls the parent onSubmit with the form data", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ItemFormSheet {...defaultProps({ onSubmit })} />);

    const handleSubmit = getCapturedOnSubmit();
    await act(async () => {
      await handleSubmit({ name: "Test" });
    });

    expect(onSubmit).toHaveBeenCalledWith({ name: "Test" });
  });

  it("recovers cleanly when onSubmit rejects (no crash, no rethrow)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // suppress expected error log
    });
    const onSubmit = vi.fn().mockRejectedValue(new Error("server down"));

    render(<ItemFormSheet {...defaultProps({ onSubmit })} />);

    const handleSubmit = getCapturedOnSubmit();
    // Must not throw — handleFormSubmit catches internally
    await act(async () => {
      await expect(handleSubmit({ name: "Test" })).resolves.toBeUndefined();
    });

    // Sheet remains rendered (open)
    expect(screen.getByTestId("sheet")).toBeInTheDocument();
    // Save button is no longer disabled (isSubmitting reset in finally)
    const saveButton = screen.getByText("collect.save");
    expect(saveButton).not.toBeDisabled();
    // Defensive log fired
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("clears the local dirty mirror after a successful submit", async () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<ItemFormSheet {...defaultProps({ onOpenChange, onSubmit })} />);

    // Simulate the form going dirty, then submitting successfully
    const propsBeforeSubmit = capturedItemFormProps.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    const onDirtyChange = propsBeforeSubmit?.onDirtyChange as
      | ((dirty: boolean) => void)
      | undefined;
    if (!onDirtyChange) {
      throw new Error("onDirtyChange not passed to ItemForm");
    }
    act(() => {
      onDirtyChange(true);
    });

    const handleSubmit = getCapturedOnSubmit();
    await act(async () => {
      await handleSubmit({ name: "Test" });
    });

    // After successful submit, simulating a Sheet-driven close should not
    // trigger the discard dialog (formDirty was cleared).
    act(() => {
      capturedSheetOnOpenChange(false);
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId("discard-dialog")).not.toBeInTheDocument();
  });
});
