import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ItemId, TagId, TrickId } from "@/db/types";
import type { ParsedItem } from "../types";
import { CollectView } from "./collect-view";
import type { ItemDeleteDialogProps } from "./item-delete-dialog";
import type { ItemFiltersProps } from "./item-filters";
import type { ItemFormSheetProps } from "./item-form-sheet";

// Mock PowerSync useQuery — used directly by CollectView for the join queries.
vi.mock("@powersync/react", () => ({
  useQuery: vi.fn(() => ({
    data: [],
    isLoading: false,
    isFetching: false,
    error: undefined,
  })),
  usePowerSync: vi.fn(() => ({ execute: vi.fn() })),
}));

// Mock auth client used by mutation hooks (not relevant here but imported transitively).
vi.mock("@/auth/client", () => ({
  authClient: {
    useSession: vi.fn(() => ({ data: { user: { id: "test-user-id" } } })),
  },
}));

// Mock analytics
vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock feature-level hooks
vi.mock("../hooks/use-items", () => ({
  useItems: vi.fn(() => ({ items: [], error: null, isLoading: false })),
}));

vi.mock("../hooks/use-item", () => ({
  useItem: vi.fn(() => ({ item: null, error: null, isLoading: false })),
}));

vi.mock("../hooks/use-item-brands", () => ({
  useItemBrands: vi.fn(() => ({ brands: [], error: null })),
}));

vi.mock("../hooks/use-item-locations", () => ({
  useItemLocations: vi.fn(() => ({ locations: [], error: null })),
}));

const mockCreateItem = vi.fn().mockResolvedValue("new-item-id");
const mockUpdateItem = vi.fn().mockResolvedValue(undefined);
const mockDeleteItem = vi.fn().mockResolvedValue(undefined);

// Use importOriginal so the mock re-exports the REAL typed error classes.
// Nominal equality matters: the production code uses `instanceof` checks, so
// if the test declared its own classes the `instanceof` branches would never
// fire and the translated-toast paths would be uncovered.
vi.mock("../hooks/use-item-mutations", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../hooks/use-item-mutations")>();
  return {
    ...actual,
    useItemMutations: vi.fn(() => ({
      createItem: mockCreateItem,
      updateItem: mockUpdateItem,
      deleteItem: mockDeleteItem,
    })),
  };
});

vi.mock("@/features/repertoire/hooks/use-tags", () => ({
  useTags: vi.fn(() => ({ tags: [], isLoading: false })),
}));

vi.mock("@/features/repertoire/hooks/use-tag-mutations", () => ({
  useTagMutations: vi.fn(() => ({
    createTag: vi.fn().mockResolvedValue("new-tag-id"),
  })),
}));

// Mock child components so we can capture and drive their props
let capturedFormSheetProps: Partial<ItemFormSheetProps> = {};

vi.mock("./item-form-sheet", () => ({
  ItemFormSheet: (props: ItemFormSheetProps) => {
    capturedFormSheetProps = props;
    return <div data-open={String(props.open)} data-testid="item-form-sheet" />;
  },
}));

let capturedDeleteDialogProps: Partial<ItemDeleteDialogProps> = {};

vi.mock("./item-delete-dialog", () => ({
  ItemDeleteDialog: (props: ItemDeleteDialogProps) => {
    capturedDeleteDialogProps = props;
    return (
      <div data-open={String(props.open)} data-testid="item-delete-dialog">
        {props.open && (
          <button
            data-testid="confirm-delete"
            onClick={props.onConfirm}
            type="button"
          >
            Confirm
          </button>
        )}
      </div>
    );
  },
}));

let capturedFiltersProps: Partial<ItemFiltersProps> = {};

vi.mock("./item-filters", () => ({
  ItemFilters: (props: ItemFiltersProps) => {
    capturedFiltersProps = props;
    return (
      <div>
        <input
          aria-label="collect.searchPlaceholder"
          onChange={(e) => props.onSearchChange(e.target.value)}
          type="search"
          value={props.search}
        />
      </div>
    );
  },
}));

vi.mock("./item-list", () => ({
  ItemList: ({
    items,
    onEdit,
    onDelete,
  }: {
    items: { id: ItemId; name: string }[];
    onEdit: (id: ItemId) => void;
    onDelete: (id: ItemId) => void;
  }) => (
    <div data-testid="item-list">
      {items.map((item) => (
        <div key={item.id}>
          <span>{item.name}</span>
          <button
            data-testid={`edit-${item.id}`}
            onClick={() => onEdit(item.id)}
            type="button"
          >
            Edit
          </button>
          <button
            data-testid={`delete-${item.id}`}
            onClick={() => onDelete(item.id)}
            type="button"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock("./item-empty-state", () => ({
  ItemEmptyState: ({ onAddItem }: { onAddItem: () => void }) => (
    <button data-testid="item-empty-state" onClick={onAddItem} type="button">
      Add your first item
    </button>
  ),
}));

const ADD_ITEM_PATTERN = /collect.addItem/i;

function makeItem(
  id: string,
  name: string,
  overrides: Partial<ParsedItem> = {}
): ParsedItem {
  return {
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
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeFormValues(
  overrides: Record<string, unknown> = {}
): Parameters<NonNullable<ItemFormSheetProps["onSubmit"]>>[0] {
  return {
    name: "Test",
    type: "prop",
    description: "",
    brand: "",
    creator: "",
    condition: null,
    location: "",
    quantity: 1,
    purchaseDate: "",
    purchasePrice: "",
    url: "",
    notes: "",
    ...overrides,
  } as Parameters<NonNullable<ItemFormSheetProps["onSubmit"]>>[0];
}

afterEach(async () => {
  vi.useRealTimers();
  vi.clearAllMocks();

  const { useQuery } = await import("@powersync/react");
  const { useItems } = await import("../hooks/use-items");
  const { useItem } = await import("../hooks/use-item");

  vi.mocked(useQuery).mockReturnValue({
    data: [],
    isLoading: false,
    isFetching: false,
    error: undefined,
  });
  vi.mocked(useItems).mockReturnValue({
    items: [],
    error: null,
    isLoading: false,
  });
  vi.mocked(useItem).mockReturnValue({
    item: null,
    error: null,
    isLoading: false,
  });

  mockCreateItem.mockResolvedValue("new-item-id");
  mockUpdateItem.mockResolvedValue(undefined);
  mockDeleteItem.mockResolvedValue(undefined);

  capturedFormSheetProps = {};
  capturedDeleteDialogProps = {};
  capturedFiltersProps = {};
});

describe("CollectView", () => {
  it("renders without crashing", () => {
    render(<CollectView />);
    expect(screen.getByText("collect.title")).toBeInTheDocument();
  });

  it("shows empty state when there are no items and no filters", () => {
    render(<CollectView />);
    expect(screen.getByTestId("item-empty-state")).toBeInTheDocument();
  });

  it("opens sheet in create mode when add button is clicked", async () => {
    render(<CollectView />);
    await userEvent.click(
      screen.getByRole("button", { name: ADD_ITEM_PATTERN })
    );
    expect(capturedFormSheetProps.open).toBe(true);
    expect(capturedFormSheetProps.selectedTagIds).toEqual([]);
    expect(capturedFormSheetProps.selectedTrickIds).toEqual([]);
  });

  it("creates an item with selected tags and tricks on submit", async () => {
    render(<CollectView />);

    // Open sheet
    await userEvent.click(
      screen.getByRole("button", { name: ADD_ITEM_PATTERN })
    );

    // Select a tag and a trick via the captured handlers
    act(() => {
      capturedFormSheetProps.onToggleTag?.(
        "00000000-0000-4000-8000-00000000bb01" as TagId
      );
    });
    act(() => {
      capturedFormSheetProps.onToggleTrick?.(
        "00000000-0000-4000-8000-00000000cc01" as TrickId
      );
    });

    // Submit the form
    await capturedFormSheetProps.onSubmit?.(
      makeFormValues({ name: "Invisible Deck" })
    );

    expect(mockCreateItem).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Invisible Deck" }),
      ["00000000-0000-4000-8000-00000000bb01"],
      ["00000000-0000-4000-8000-00000000cc01"]
    );

    const { toast } = await import("sonner");
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("collect.itemCreated");
    });
  });

  it("computes set-diff for tags in edit mode (add and remove)", async () => {
    const { useItems } = await import("../hooks/use-items");
    const { useItem } = await import("../hooks/use-item");
    const { useQuery } = await import("@powersync/react");

    const item = makeItem(
      "00000000-0000-4000-8000-0000000ed170",
      "Ambitious Card"
    );
    vi.mocked(useItems).mockReturnValue({
      items: [item],
      error: null,
      isLoading: false,
    });
    vi.mocked(useItem).mockReturnValue({
      item,
      error: null,
      isLoading: false,
    });

    // The first useQuery call is the item_tags join — seed it with two existing tags
    vi.mocked(useQuery).mockImplementation((sql) => {
      if (typeof sql === "string" && sql.includes("FROM item_tags")) {
        return {
          data: [
            {
              item_id: "00000000-0000-4000-8000-0000000ed170",
              tag_id: "00000000-0000-4000-8000-0000000000a1",
              tag_name: "00000000-0000-4000-8000-0000000000a1",
              color: null,
            },
            {
              item_id: "00000000-0000-4000-8000-0000000ed170",
              tag_id: "00000000-0000-4000-8000-0000000000a2",
              tag_name: "00000000-0000-4000-8000-0000000000a2",
              color: null,
            },
          ],
          isLoading: false,
          isFetching: false,
          error: undefined,
        };
      }
      return {
        data: [],
        isLoading: false,
        isFetching: false,
        error: undefined,
      };
    });

    render(<CollectView />);

    // Click edit — initial selectedTagIds should be [t1, t2]
    await userEvent.click(
      screen.getByTestId("edit-00000000-0000-4000-8000-0000000ed170")
    );
    expect(capturedFormSheetProps.selectedTagIds).toEqual([
      "00000000-0000-4000-8000-0000000000a1",
      "00000000-0000-4000-8000-0000000000a2",
    ]);

    // Remove t2 and add t3
    act(() => {
      capturedFormSheetProps.onToggleTag?.(
        "00000000-0000-4000-8000-0000000000a2" as TagId
      );
    });
    act(() => {
      capturedFormSheetProps.onToggleTag?.(
        "00000000-0000-4000-8000-0000000000a3" as TagId
      );
    });

    // Submit — updateItem should be called with addTagIds=[t3], removeTagIds=[t2]
    await capturedFormSheetProps.onSubmit?.(
      makeFormValues({ name: "Ambitious Card" })
    );

    expect(mockUpdateItem).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-0000000ed170",
      expect.any(Object),
      ["00000000-0000-4000-8000-0000000000a3"],
      ["00000000-0000-4000-8000-0000000000a2"],
      [],
      []
    );
  });

  it("produces an empty diff when tags are reordered but unchanged", async () => {
    const { useItems } = await import("../hooks/use-items");
    const { useItem } = await import("../hooks/use-item");
    const { useQuery } = await import("@powersync/react");

    const item = makeItem("00000000-0000-4000-8000-0000000ed171", "Card Warp");
    vi.mocked(useItems).mockReturnValue({
      items: [item],
      error: null,
      isLoading: false,
    });
    vi.mocked(useItem).mockReturnValue({
      item,
      error: null,
      isLoading: false,
    });
    vi.mocked(useQuery).mockImplementation((sql) => {
      if (typeof sql === "string" && sql.includes("FROM item_tags")) {
        return {
          data: [
            {
              item_id: "00000000-0000-4000-8000-0000000ed171",
              tag_id: "00000000-0000-4000-8000-0000000000a1",
              tag_name: "00000000-0000-4000-8000-0000000000a1",
              color: null,
            },
            {
              item_id: "00000000-0000-4000-8000-0000000ed171",
              tag_id: "00000000-0000-4000-8000-0000000000a2",
              tag_name: "00000000-0000-4000-8000-0000000000a2",
              color: null,
            },
          ],
          isLoading: false,
          isFetching: false,
          error: undefined,
        };
      }
      return {
        data: [],
        isLoading: false,
        isFetching: false,
        error: undefined,
      };
    });

    render(<CollectView />);

    await userEvent.click(
      screen.getByTestId("edit-00000000-0000-4000-8000-0000000ed171")
    );

    // Toggle t1 off, t2 off, t2 on, t1 on — same set, different insert order
    act(() => {
      capturedFormSheetProps.onToggleTag?.(
        "00000000-0000-4000-8000-0000000000a1" as TagId
      );
    });
    act(() => {
      capturedFormSheetProps.onToggleTag?.(
        "00000000-0000-4000-8000-0000000000a2" as TagId
      );
    });
    act(() => {
      capturedFormSheetProps.onToggleTag?.(
        "00000000-0000-4000-8000-0000000000a2" as TagId
      );
    });
    act(() => {
      capturedFormSheetProps.onToggleTag?.(
        "00000000-0000-4000-8000-0000000000a1" as TagId
      );
    });

    await capturedFormSheetProps.onSubmit?.(
      makeFormValues({ name: "Card Warp" })
    );

    expect(mockUpdateItem).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-0000000ed171",
      expect.any(Object),
      [],
      [],
      [],
      []
    );
  });

  it("propagates sort changes from ItemFilters to useItems", async () => {
    const { useItems } = await import("../hooks/use-items");

    render(<CollectView />);

    // Initial render should use the "newest" default sort mapped to snake_case.
    expect(vi.mocked(useItems)).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "newest" })
    );

    // Change to name-asc — passes the kebab-case FilterSortValue through to useItems unchanged
    act(() => {
      capturedFiltersProps.onSortChange?.("name-asc");
    });

    await waitFor(() => {
      expect(vi.mocked(useItems)).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: "name-asc" })
      );
    });
  });

  it("fires a load-error toast with a stable id when items query fails", async () => {
    const { useItems } = await import("../hooks/use-items");
    vi.mocked(useItems).mockReturnValue({
      items: [],
      error: new Error("boom"),
      isLoading: false,
    });

    render(<CollectView />);

    const { toast } = await import("sonner");
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "collect.loadError",
        expect.objectContaining({ id: "collect-load-items-error" })
      );
    });
  });

  it("closes sheet and clears edit state when useItem reports an error", async () => {
    const { useItems } = await import("../hooks/use-items");
    const { useItem } = await import("../hooks/use-item");
    const item = makeItem("item-err", "Broken");
    vi.mocked(useItems).mockReturnValue({
      items: [item],
      error: null,
      isLoading: false,
    });

    // The hook reports an error — the sheet must NOT stay open on the "add new" form.
    vi.mocked(useItem).mockReturnValue({
      item: null,
      error: new Error("load failed"),
      isLoading: false,
    });

    render(<CollectView />);

    // Attempt to open the edit sheet — the load-error effect should slam it shut.
    await userEvent.click(screen.getByTestId("edit-item-err"));

    await waitFor(() => {
      expect(capturedFormSheetProps.open).toBe(false);
    });

    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(
      "collect.loadError",
      expect.objectContaining({ id: "collect-load-edit-item-error" })
    );
  });

  it("keeps the sheet open and shows an error toast when save fails", async () => {
    const { useItems } = await import("../hooks/use-items");
    const { useItem } = await import("../hooks/use-item");
    const item = makeItem("item-save-fail", "Coin Warp");
    vi.mocked(useItems).mockReturnValue({
      items: [item],
      error: null,
      isLoading: false,
    });
    vi.mocked(useItem).mockReturnValue({
      item,
      error: null,
      isLoading: false,
    });
    mockUpdateItem.mockRejectedValueOnce(new Error("update failed"));

    render(<CollectView />);

    await userEvent.click(screen.getByTestId("edit-item-save-fail"));
    expect(capturedFormSheetProps.open).toBe(true);

    // The parent rethrows after toasting so the child ItemFormSheet sees the
    // failure and skips its post-await dirty reset (per #14 fix).
    await expect(
      capturedFormSheetProps.onSubmit?.(makeFormValues({ name: "Coin Warp" }))
    ).rejects.toThrow("update failed");

    // Sheet remains open so the user can retry or cancel.
    expect(capturedFormSheetProps.open).toBe(true);

    const { toast } = await import("sonner");
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("collect.saveFailed");
    });
  });

  // Typed-error toast coverage. The mock re-exports the real error classes
  // via importOriginal so `instanceof` checks in production code fire
  // correctly across the mock boundary (finding #12/#18).
  it("toasts validation.tooManyTags when MaxTagsError is thrown on save", async () => {
    const { MaxTagsError } = await import("../hooks/use-item-mutations");
    const { useItems } = await import("../hooks/use-items");
    const { useItem } = await import("../hooks/use-item");
    const item = makeItem("item-tags", "Rope");
    vi.mocked(useItems).mockReturnValue({
      items: [item],
      error: null,
      isLoading: false,
    });
    vi.mocked(useItem).mockReturnValue({
      item,
      error: null,
      isLoading: false,
    });
    mockUpdateItem.mockRejectedValueOnce(new MaxTagsError());

    render(<CollectView />);

    await userEvent.click(screen.getByTestId("edit-item-tags"));

    await expect(
      capturedFormSheetProps.onSubmit?.(makeFormValues({ name: "Rope" }))
    ).rejects.toBeInstanceOf(MaxTagsError);

    const { toast } = await import("sonner");
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "collect.validation.tooManyTags"
      );
    });
    // Generic saveFailed must NOT fire when we've already shown the specific
    // typed-error toast.
    expect(toast.error).not.toHaveBeenCalledWith("collect.saveFailed");
  });

  it("toasts validation.tooManyTricks with the cap count when MaxTricksError is thrown on save", async () => {
    const { MaxTricksError } = await import("../hooks/use-item-mutations");
    const { useItems } = await import("../hooks/use-items");
    const { useItem } = await import("../hooks/use-item");
    const item = makeItem("item-tricks", "Thimble");
    vi.mocked(useItems).mockReturnValue({
      items: [item],
      error: null,
      isLoading: false,
    });
    vi.mocked(useItem).mockReturnValue({
      item,
      error: null,
      isLoading: false,
    });
    mockUpdateItem.mockRejectedValueOnce(new MaxTricksError());

    render(<CollectView />);

    await userEvent.click(screen.getByTestId("edit-item-tricks"));

    await expect(
      capturedFormSheetProps.onSubmit?.(makeFormValues({ name: "Thimble" }))
    ).rejects.toBeInstanceOf(MaxTricksError);

    const { toast } = await import("sonner");
    // The translation key is parameterized with `{count}` — the global
    // next-intl mock renders interpolation as "(count: N)", so we assert on
    // the key prefix to stay decoupled from the exact cap value.
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("collect.validation.tooManyTricks")
      );
    });
    expect(toast.error).not.toHaveBeenCalledWith("collect.saveFailed");
  });

  it("toasts errors.itemMissing when ItemNotFoundError is thrown on delete", async () => {
    const { ItemNotFoundError } = await import("../hooks/use-item-mutations");
    const { useItems } = await import("../hooks/use-items");
    const item = makeItem("item-missing", "Vanishing Silk");
    vi.mocked(useItems).mockReturnValue({
      items: [item],
      error: null,
      isLoading: false,
    });
    mockDeleteItem.mockRejectedValueOnce(new ItemNotFoundError());

    render(<CollectView />);

    await userEvent.click(screen.getByTestId("delete-item-missing"));
    expect(capturedDeleteDialogProps.open).toBe(true);
    await userEvent.click(screen.getByTestId("confirm-delete"));

    const { toast } = await import("sonner");
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("collect.errors.itemMissing");
    });
    // Generic deleteFailed must NOT fire when we've already shown the
    // specific itemMissing toast.
    expect(toast.error).not.toHaveBeenCalledWith("collect.deleteFailed");
    // Dialog still clears in the finally block on typed-error path.
    await waitFor(() => {
      expect(capturedDeleteDialogProps.open).toBe(false);
    });
  });

  it("clears delete state in finally block on success and failure", async () => {
    const { useItems } = await import("../hooks/use-items");
    const item = makeItem("item-del", "Silk");
    vi.mocked(useItems).mockReturnValue({
      items: [item],
      error: null,
      isLoading: false,
    });

    render(<CollectView />);

    // Success path
    await userEvent.click(screen.getByTestId("delete-item-del"));
    expect(capturedDeleteDialogProps.open).toBe(true);
    await userEvent.click(screen.getByTestId("confirm-delete"));

    await waitFor(() => {
      expect(mockDeleteItem).toHaveBeenCalledWith("item-del");
      expect(capturedDeleteDialogProps.open).toBe(false);
    });

    // Failure path — finally still clears state
    mockDeleteItem.mockRejectedValueOnce(new Error("boom"));
    await userEvent.click(screen.getByTestId("delete-item-del"));
    expect(capturedDeleteDialogProps.open).toBe(true);
    await userEvent.click(screen.getByTestId("confirm-delete"));

    await waitFor(() => {
      expect(capturedDeleteDialogProps.open).toBe(false);
    });
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith("collect.deleteFailed");
  });

  // ---------------------------------------------------------------------------
  // Issue #216 — hydration-race regression coverage
  // ---------------------------------------------------------------------------

  // (Test A) When Edit is clicked before the join queries hydrate, the form
  // sheet is gated (relationsLoading=true) and the seeding effect waits.
  // Once the join hydrates, selection is seeded from real data; saving
  // without further interaction emits empty diffs (no silent unlink).
  it("seeds selection from hydrated joins and never emits a stale diff (issue #216)", async () => {
    const { useItems } = await import("../hooks/use-items");
    const { useItem } = await import("../hooks/use-item");
    const { useQuery } = await import("@powersync/react");

    const itemId = "00000000-0000-4000-8000-0000000ed172";
    const item = makeItem(itemId, "Linking Rings");
    vi.mocked(useItems).mockReturnValue({
      items: [item],
      error: null,
      isLoading: false,
    });
    vi.mocked(useItem).mockReturnValue({
      item,
      error: null,
      isLoading: false,
    });
    // Joins not hydrated yet — empty data with isLoading: true.
    vi.mocked(useQuery).mockReturnValue({
      data: [],
      isLoading: true,
      isFetching: true,
      error: undefined,
    });

    const { rerender } = render(<CollectView />);

    // Click Edit while joins are still loading.
    await userEvent.click(screen.getByTestId(`edit-${itemId}`));

    // Sheet opened, but relations are gated.
    expect(capturedFormSheetProps.open).toBe(true);
    expect(capturedFormSheetProps.relationsLoading).toBe(true);
    // Parent coerces null sentinel to [] for the sheet's prop type.
    expect(capturedFormSheetProps.selectedTagIds).toEqual([]);
    expect(capturedFormSheetProps.selectedTrickIds).toEqual([]);

    // Defense-in-depth: a keyboard-driven submit while still seeding must
    // not call updateItem at all (Save is also disabled in the sheet).
    await capturedFormSheetProps.onSubmit?.(
      makeFormValues({ name: "Linking Rings" })
    );
    expect(mockUpdateItem).not.toHaveBeenCalled();

    // Joins hydrate with two existing tags for this item.
    const t1 = "00000000-0000-4000-8000-0000000000a1" as TagId;
    const t2 = "00000000-0000-4000-8000-0000000000a2" as TagId;
    vi.mocked(useQuery).mockImplementation((sql) => {
      if (typeof sql === "string" && sql.includes("FROM item_tags")) {
        return {
          data: [
            {
              item_id: itemId,
              tag_id: t1,
              tag_name: t1,
              color: null,
            },
            {
              item_id: itemId,
              tag_id: t2,
              tag_name: t2,
              color: null,
            },
          ],
          isLoading: false,
          isFetching: false,
          error: undefined,
        };
      }
      return {
        data: [],
        isLoading: false,
        isFetching: false,
        error: undefined,
      };
    });
    rerender(<CollectView />);

    // After hydration the seeding effect populates both selected/original
    // from the join, and the gate lifts.
    await waitFor(() => {
      expect(capturedFormSheetProps.relationsLoading).toBe(false);
      expect(capturedFormSheetProps.selectedTagIds).toEqual([t1, t2]);
    });
    // Snapshot semantics: post-seed, selected === original, so dirty flags
    // remain false. If seeding ever drifted to non-equal arrays, the discard
    // dialog would falsely trigger — this assertion locks the property.
    expect(capturedFormSheetProps.tagsDirty).toBe(false);
    expect(capturedFormSheetProps.tricksDirty).toBe(false);

    // Submit without touching the picker — issue #216 used to emit
    // removeTagIds=[t1,t2] silently. Now the diff is empty.
    await capturedFormSheetProps.onSubmit?.(
      makeFormValues({ name: "Linking Rings" })
    );
    expect(mockUpdateItem).toHaveBeenCalledWith(
      itemId,
      expect.any(Object),
      [],
      [],
      [],
      []
    );
  });

  // (Test C) Closing the sheet mid-load and reopening after hydration must
  // re-seed cleanly — no leaked sentinel from the previous session.
  it("re-seeds cleanly when Edit is reopened after closing mid-load", async () => {
    const { useItems } = await import("../hooks/use-items");
    const { useItem } = await import("../hooks/use-item");
    const { useQuery } = await import("@powersync/react");

    const itemId = "00000000-0000-4000-8000-0000000ed173";
    const item = makeItem(itemId, "Cups & Balls");
    vi.mocked(useItems).mockReturnValue({
      items: [item],
      error: null,
      isLoading: false,
    });
    vi.mocked(useItem).mockReturnValue({
      item,
      error: null,
      isLoading: false,
    });
    vi.mocked(useQuery).mockReturnValue({
      data: [],
      isLoading: true,
      isFetching: true,
      error: undefined,
    });

    const { rerender } = render(<CollectView />);

    await userEvent.click(screen.getByTestId(`edit-${itemId}`));
    expect(capturedFormSheetProps.relationsLoading).toBe(true);

    // Close mid-load.
    act(() => {
      capturedFormSheetProps.onOpenChange?.(false);
    });
    expect(capturedFormSheetProps.open).toBe(false);

    // Hydrate BOTH joins (tags + tricks) so that selected/original re-seed
    // for each — a regression on either side must be detectable below.
    const t1 = "00000000-0000-4000-8000-0000000000b1" as TagId;
    const tr1 = "00000000-0000-4000-8000-00000000ee01" as TrickId;
    vi.mocked(useQuery).mockImplementation((sql) => {
      if (typeof sql === "string" && sql.includes("FROM item_tags")) {
        return {
          data: [
            {
              item_id: itemId,
              tag_id: t1,
              tag_name: t1,
              color: null,
            },
          ],
          isLoading: false,
          isFetching: false,
          error: undefined,
        };
      }
      if (typeof sql === "string" && sql.includes("FROM item_tricks")) {
        return {
          data: [
            {
              item_id: itemId,
              trick_id: tr1,
              trick_name: "Coin Vanish",
            },
          ],
          isLoading: false,
          isFetching: false,
          error: undefined,
        };
      }
      return {
        data: [],
        isLoading: false,
        isFetching: false,
        error: undefined,
      };
    });
    rerender(<CollectView />);

    // Reopen Edit — seed fires fresh from the now-hydrated joins.
    await userEvent.click(screen.getByTestId(`edit-${itemId}`));
    await waitFor(() => {
      expect(capturedFormSheetProps.relationsLoading).toBe(false);
      expect(capturedFormSheetProps.selectedTagIds).toEqual([t1]);
      expect(capturedFormSheetProps.selectedTrickIds).toEqual([tr1]);
    });

    // Submit with no further interaction → diff must be empty in BOTH tag
    // and trick arrays. A regression where `selected` re-seeds but `original`
    // stays stale at [] (or vice versa) would compute a phantom remove/add
    // on either side and fail this assertion.
    await capturedFormSheetProps.onSubmit?.(
      makeFormValues({ name: "Cups & Balls" })
    );
    expect(mockUpdateItem).toHaveBeenCalledWith(
      itemId,
      expect.any(Object),
      [],
      [],
      [],
      []
    );
  });

  // (Test D) Adjacent useItem race: keyboard-submitting before the trick row
  // hydrates (item===null) must not invoke updateItem with RHF defaults.
  it("gates Save and short-circuits submit while useItem is still loading (issue #216)", async () => {
    const { useItems } = await import("../hooks/use-items");
    const { useItem } = await import("../hooks/use-item");

    const itemId = "00000000-0000-4000-8000-0000000ed174";
    const item = makeItem(itemId, "Sponge Balls");
    vi.mocked(useItems).mockReturnValue({
      items: [item],
      error: null,
      isLoading: false,
    });
    // useItem reports isLoading: true — the row hasn't materialised yet.
    vi.mocked(useItem).mockReturnValue({
      item: null,
      error: null,
      isLoading: true,
    });

    const { rerender } = render(<CollectView />);

    await userEvent.click(screen.getByTestId(`edit-${itemId}`));
    expect(capturedFormSheetProps.relationsLoading).toBe(true);

    // Keyboard submit while still loading — defense in depth.
    await capturedFormSheetProps.onSubmit?.(
      makeFormValues({ name: "Sponge Balls" })
    );
    expect(mockUpdateItem).not.toHaveBeenCalled();

    // Hydrate the row.
    vi.mocked(useItem).mockReturnValue({
      item,
      error: null,
      isLoading: false,
    });
    rerender(<CollectView />);

    await waitFor(() => {
      expect(capturedFormSheetProps.relationsLoading).toBe(false);
    });

    // Now submit goes through.
    await capturedFormSheetProps.onSubmit?.(
      makeFormValues({ name: "Sponge Balls" })
    );
    expect(mockUpdateItem).toHaveBeenCalledWith(
      itemId,
      expect.any(Object),
      [],
      [],
      [],
      []
    );
  });

  // (Test E) Background sync adds a tag while the user is editing. The
  // delta-only mutation + lock-in seeding combo must NOT silently emit the
  // sync-added tag as a phantom add or remove.
  it("does not emit phantom diffs when the join updates from background sync", async () => {
    const { useItems } = await import("../hooks/use-items");
    const { useItem } = await import("../hooks/use-item");
    const { useQuery } = await import("@powersync/react");

    const itemId = "00000000-0000-4000-8000-0000000ed175";
    const item = makeItem(itemId, "Coin Vanish");
    vi.mocked(useItems).mockReturnValue({
      items: [item],
      error: null,
      isLoading: false,
    });
    vi.mocked(useItem).mockReturnValue({
      item,
      error: null,
      isLoading: false,
    });

    const t1 = "00000000-0000-4000-8000-0000000000c1" as TagId;
    const t2 = "00000000-0000-4000-8000-0000000000c2" as TagId;

    vi.mocked(useQuery).mockImplementation((sql) => {
      if (typeof sql === "string" && sql.includes("FROM item_tags")) {
        return {
          data: [
            { item_id: itemId, tag_id: t1, tag_name: t1, color: null },
            { item_id: itemId, tag_id: t2, tag_name: t2, color: null },
          ],
          isLoading: false,
          isFetching: false,
          error: undefined,
        };
      }
      return {
        data: [],
        isLoading: false,
        isFetching: false,
        error: undefined,
      };
    });

    const { rerender } = render(<CollectView />);

    await userEvent.click(screen.getByTestId(`edit-${itemId}`));
    await waitFor(() => {
      expect(capturedFormSheetProps.selectedTagIds).toEqual([t1, t2]);
    });

    // Background sync adds t3 to the join.
    const t3 = "00000000-0000-4000-8000-0000000000c3" as TagId;
    vi.mocked(useQuery).mockImplementation((sql) => {
      if (typeof sql === "string" && sql.includes("FROM item_tags")) {
        return {
          data: [
            { item_id: itemId, tag_id: t1, tag_name: t1, color: null },
            { item_id: itemId, tag_id: t2, tag_name: t2, color: null },
            { item_id: itemId, tag_id: t3, tag_name: t3, color: null },
          ],
          isLoading: false,
          isFetching: false,
          error: undefined,
        };
      }
      return {
        data: [],
        isLoading: false,
        isFetching: false,
        error: undefined,
      };
    });
    rerender(<CollectView />);

    // User saves without touching the picker — selection still [t1, t2],
    // original still [t1, t2] (locked-in seed). Diff must be empty: t3 is
    // preserved by the delta-only mutation hook with no client emission.
    await capturedFormSheetProps.onSubmit?.(
      makeFormValues({ name: "Coin Vanish" })
    );
    expect(mockUpdateItem).toHaveBeenCalledWith(
      itemId,
      expect.any(Object),
      [],
      [],
      [],
      []
    );
  });

  // (Test F) Add path is never gated — relationsLoading must be false even
  // when joins are still loading, because handleAddItem seeds [] up front.
  it("does not gate the Add path while joins are loading", async () => {
    const { useQuery } = await import("@powersync/react");
    vi.mocked(useQuery).mockReturnValue({
      data: [],
      isLoading: true,
      isFetching: true,
      error: undefined,
    });

    render(<CollectView />);

    await userEvent.click(
      screen.getByRole("button", { name: ADD_ITEM_PATTERN })
    );

    expect(capturedFormSheetProps.open).toBe(true);
    expect(capturedFormSheetProps.relationsLoading).toBe(false);
    expect(capturedFormSheetProps.selectedTagIds).toEqual([]);
    expect(capturedFormSheetProps.selectedTrickIds).toEqual([]);

    // Submit while joins are still isLoading: true. The Add path is NOT
    // gated, so createItem must run with empty link arrays. A regression
    // that wraps the create branch in a relationsLoading guard would skip
    // the call here and fail this assertion.
    await capturedFormSheetProps.onSubmit?.(
      makeFormValues({ name: "New Prop" })
    );
    expect(mockCreateItem).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Prop" }),
      [],
      []
    );
  });

  it("rethrows when createTag fails (TagPicker owns the toast)", async () => {
    const { useTagMutations } = await import(
      "@/features/repertoire/hooks/use-tag-mutations"
    );
    const mockCreateTag = vi.fn().mockRejectedValue(new Error("tag boom"));
    vi.mocked(useTagMutations).mockReturnValue({ createTag: mockCreateTag });

    render(<CollectView />);
    await userEvent.click(
      screen.getByRole("button", { name: ADD_ITEM_PATTERN })
    );

    await expect(
      capturedFormSheetProps.onCreateTag?.("Mentalism")
    ).rejects.toThrow("tag boom");

    // collect-view no longer toasts here — TagPicker owns the user-facing toast
    // to avoid double-toasting (per convergence finding #5).
    const { toast } = await import("sonner");
    expect(toast.error).not.toHaveBeenCalledWith(
      "collect.tagPicker.createFailed",
      expect.anything()
    );
  });
});
