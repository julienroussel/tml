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
    ...rest
  }: {
    children: ReactNode;
    onClick?: () => void;
    type?: string;
    form?: string;
    variant?: string;
  }) => (
    <button
      data-variant={rest.variant}
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
    item: null,
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

    render(<ItemFormSheet {...defaultProps({ item })} />);

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

    render(<ItemFormSheet {...defaultProps({ item })} />);

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

    render(<ItemFormSheet {...defaultProps({ item })} />);

    const defaultValues = getFormDefaults();
    expect(defaultValues?.purchasePrice).toBe("0");
  });

  it("passes undefined defaultValues when item is null (create mode)", () => {
    render(<ItemFormSheet {...defaultProps({ item: null })} />);

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

    render(<ItemFormSheet {...defaultProps({ item })} />);

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
    render(<ItemFormSheet {...defaultProps({ item: null })} />);

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

    render(<ItemFormSheet {...defaultProps({ item })} />);

    expect(screen.getByText("collect.editItem")).toBeInTheDocument();
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
