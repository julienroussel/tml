import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ItemId, TagId, TrickId } from "@/db/types";
import type { ParsedItem } from "../types";
import {
  AVAILABLE_TRICKS_QUERY,
  CollectView,
  ITEM_TAGS_QUERY,
  ITEM_TRICKS_QUERY,
} from "./collect-view";
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
  useTags: vi.fn(() => ({ tags: [], isLoading: false, error: null })),
}));

vi.mock("@/features/repertoire/hooks/use-tag-mutations", () => ({
  useTagMutations: vi.fn(() => ({
    createTag: vi.fn().mockResolvedValue("new-tag-id"),
  })),
}));

// Mock child components so we can capture and drive their props
let capturedFormSheetProps: Partial<ItemFormSheetProps> = {};
// Records every `open` value the mock has seen. Lets block-on-error tests
// distinguish "handler-gate prevented open" from "auto-close effect closed
// after a brief open" — they're indistinguishable from the final `open` prop
// alone. Reset in afterEach.
const formSheetOpenHistory: boolean[] = [];

vi.mock("./item-form-sheet", () => ({
  ItemFormSheet: (props: ItemFormSheetProps) => {
    capturedFormSheetProps = props;
    formSheetOpenHistory.push(props.open);
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
  const { useTags } = await import("@/features/repertoire/hooks/use-tags");

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
  vi.mocked(useTags).mockReturnValue({
    tags: [],
    isLoading: false,
    error: null,
  });

  mockCreateItem.mockResolvedValue("new-item-id");
  mockUpdateItem.mockResolvedValue(undefined);
  mockDeleteItem.mockResolvedValue(undefined);

  capturedFormSheetProps = {};
  formSheetOpenHistory.length = 0;
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
      if (sql === ITEM_TAGS_QUERY) {
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
      if (sql === ITEM_TAGS_QUERY) {
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
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(
      "collect.loadError",
      expect.objectContaining({ id: "collect-load-relations-error" })
    );

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

  // ---------------------------------------------------------------------------
  // Issue #217 — discriminated edit-target mode (create / loading / edit)
  // ---------------------------------------------------------------------------

  it("passes mode 'loading' to the sheet while the edit target is in flight", async () => {
    const { useItems } = await import("../hooks/use-items");
    const { useItem } = await import("../hooks/use-item");
    const itemId = "00000000-0000-4000-8000-0000000ed217";
    const item = makeItem(itemId, "Linking Rings");
    vi.mocked(useItems).mockReturnValue({
      items: [item],
      error: null,
      isLoading: false,
    });
    // Row query in flight — no row yet, isLoading true.
    vi.mocked(useItem).mockReturnValue({
      item: null,
      error: null,
      isLoading: true,
    });

    const { rerender } = render(<CollectView />);
    await userEvent.click(screen.getByTestId(`edit-${itemId}`));

    // Intent is "edit", but the row hasn't hydrated — sheet shows loading mode,
    // never "Add" (issue #217).
    expect(capturedFormSheetProps.open).toBe(true);
    expect(capturedFormSheetProps.mode).toEqual({ mode: "loading" });
    // The production safety property: whenever the sheet is in mode:"loading",
    // relationsLoading is also true — that's what keeps Save disabled. Lock it
    // at the view level since the sheet-level test can't observe the coupling.
    expect(capturedFormSheetProps.relationsLoading).toBe(true);
    // An in-flight (not errored, not settled-missing) edit target must NOT
    // trip the close-on-error toast path. Lock the negative branch.
    const { toast } = await import("sonner");
    expect(toast.error).not.toHaveBeenCalledWith(
      "collect.itemNoLongerExists",
      expect.anything()
    );

    // Row settles — mode flips to "edit" with the resolved item.
    vi.mocked(useItem).mockReturnValue({
      item,
      error: null,
      isLoading: false,
    });
    rerender(<CollectView />);
    await waitFor(() => {
      expect(capturedFormSheetProps.mode).toEqual({ mode: "edit", item });
    });
  });

  it("keeps mode 'edit' through an isFetching flicker on a steady edit session (issue #217)", async () => {
    // The core regression #217 prevents: PowerSync re-emits the items table for
    // an unrelated reason, so useItem folds isFetching into isLoading:true even
    // though the matching row is still present. deriveSheetMode keys on row
    // identity, not isLoading — so mode must stay {mode:"edit"}, ItemForm stays
    // mounted, and the user's typed text is not lost.
    const { useItems } = await import("../hooks/use-items");
    const { useItem } = await import("../hooks/use-item");
    const itemId = "00000000-0000-4000-8000-0000000ed21f";
    const item = makeItem(itemId, "Floating Table");
    vi.mocked(useItems).mockReturnValue({
      items: [item],
      error: null,
      isLoading: false,
    });
    // Item present AND its id matches editingItemId, but isLoading:true (the
    // isFetching flicker on an unrelated items-table re-emit).
    vi.mocked(useItem).mockReturnValue({
      item,
      error: null,
      isLoading: true,
    });

    render(<CollectView />);
    await userEvent.click(screen.getByTestId(`edit-${itemId}`));

    // Mode stays "edit" — does NOT drop to "loading" despite isLoading:true.
    expect(capturedFormSheetProps.mode).toEqual({ mode: "edit", item });
    // The hydrated-selection hooks settled (joins not loading), so the only
    // term that could gate Save is sheetMode — which is "edit". Save is open.
    expect(capturedFormSheetProps.relationsLoading).toBe(false);
  });

  it("keeps mode 'loading' when useItem still holds the previous edit target's row", async () => {
    // Edit→Edit target switch: editingItemId is B, but useWatchedQuery can
    // still report the prior query's row (A) for one frame. deriveSheetMode
    // keys on row id, not isLoading — a stale row reads as "loading", never
    // "edit" with the wrong item (issue #217 identity gate).
    const { useItems } = await import("../hooks/use-items");
    const { useItem } = await import("../hooks/use-item");
    const idA = "00000000-0000-4000-8000-0000000ed21a";
    const idB = "00000000-0000-4000-8000-0000000ed21b";
    const itemA = makeItem(idA, "Cups and Balls");
    const itemB = makeItem(idB, "Linking Rings");
    vi.mocked(useItems).mockReturnValue({
      items: [itemA, itemB],
      error: null,
      isLoading: false,
    });
    // Stale: the query param is now B, but the resolved row is still A.
    vi.mocked(useItem).mockReturnValue({
      item: itemA,
      error: null,
      isLoading: false,
    });

    render(<CollectView />);
    await userEvent.click(screen.getByTestId(`edit-${idB}`));

    expect(capturedFormSheetProps.open).toBe(true);
    expect(capturedFormSheetProps.mode).toEqual({ mode: "loading" });
    // A stale non-null row must still gate Save — relationsLoading stays true
    // because sheetMode is "loading".
    expect(capturedFormSheetProps.relationsLoading).toBe(true);
    // The whole point of the identity gate: a stale (non-null) row must NOT
    // trip the settledMissing close path. Lock the negative branch so a
    // regression that mis-fires settledMissing on a stale row fails here.
    const { toast } = await import("sonner");
    expect(toast.error).not.toHaveBeenCalledWith(
      "collect.itemNoLongerExists",
      expect.anything()
    );
  });

  it("closes the edit sheet when the item row settles with no match", async () => {
    const { useItems } = await import("../hooks/use-items");
    const { useItem } = await import("../hooks/use-item");
    const itemId = "00000000-0000-4000-8000-0000000ed218";
    vi.mocked(useItems).mockReturnValue({
      items: [makeItem(itemId, "Vanished")],
      error: null,
      isLoading: false,
    });
    // Query settled (isLoading false) but no row — the item was deleted out
    // from under the user. The sheet must close, not hang on a skeleton.
    vi.mocked(useItem).mockReturnValue({
      item: null,
      error: null,
      isLoading: false,
    });

    render(<CollectView />);
    await userEvent.click(screen.getByTestId(`edit-${itemId}`));

    await waitFor(() => {
      expect(capturedFormSheetProps.open).toBe(false);
    });
    const { toast } = await import("sonner");
    // Settled-missing (deleted on another device) toasts the dedicated
    // "no longer exists" key, not the generic load-error key — nothing
    // failed to load. Distinct stable id from loadError so a retry sequence
    // shows both states.
    expect(toast.error).toHaveBeenCalledWith(
      "collect.itemNoLongerExists",
      expect.objectContaining({ id: "collect-item-no-longer-exists" })
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

  // ---------------------------------------------------------------------------
  // Issue #218 — silent join-query failures
  // ---------------------------------------------------------------------------

  it("blocks Edit when item_tags query has errored (issue #218)", async () => {
    const { useItems } = await import("../hooks/use-items");
    const { useQuery } = await import("@powersync/react");
    const itemId = "00000000-0000-4000-8000-00000000218a";
    const item = makeItem(itemId, "Card Force");
    vi.mocked(useItems).mockReturnValue({
      items: [item],
      error: null,
      isLoading: false,
    });

    const tagJoinError = new Error("item_tags schema drift");
    vi.mocked(useQuery).mockImplementation((sql) => {
      if (sql === ITEM_TAGS_QUERY) {
        return {
          data: [],
          isLoading: false,
          isFetching: false,
          error: tagJoinError,
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

    await userEvent.click(screen.getByTestId(`edit-${itemId}`));

    // Sheet must NOT open — guard short-circuits before setSheetOpen(true).
    expect(capturedFormSheetProps.open).toBe(false);

    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(
      "collect.loadError",
      expect.objectContaining({ id: "collect-load-relations-error" })
    );
  });

  it("blocks Edit when item_tricks query has errored (issue #218)", async () => {
    const { useItems } = await import("../hooks/use-items");
    const { useQuery } = await import("@powersync/react");
    const itemId = "00000000-0000-4000-8000-00000000218b";
    const item = makeItem(itemId, "Coin Vanish");
    vi.mocked(useItems).mockReturnValue({
      items: [item],
      error: null,
      isLoading: false,
    });

    const trickJoinError = new Error("item_tricks parse error");
    vi.mocked(useQuery).mockImplementation((sql) => {
      if (sql === ITEM_TRICKS_QUERY) {
        return {
          data: [],
          isLoading: false,
          isFetching: false,
          error: trickJoinError,
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

    await userEvent.click(screen.getByTestId(`edit-${itemId}`));

    expect(capturedFormSheetProps.open).toBe(false);

    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(
      "collect.loadError",
      expect.objectContaining({ id: "collect-load-relations-error" })
    );
  });

  it("blocks Edit when available-tricks query has errored (issue #218)", async () => {
    const { useItems } = await import("../hooks/use-items");
    const { useQuery } = await import("@powersync/react");
    const itemId = "00000000-0000-4000-8000-00000000218c";
    const item = makeItem(itemId, "Sponge Bunny");
    vi.mocked(useItems).mockReturnValue({
      items: [item],
      error: null,
      isLoading: false,
    });

    const availableTricksError = new Error("tricks query failed");
    vi.mocked(useQuery).mockImplementation((sql) => {
      if (sql === AVAILABLE_TRICKS_QUERY) {
        return {
          data: [],
          isLoading: false,
          isFetching: false,
          error: availableTricksError,
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

    await userEvent.click(screen.getByTestId(`edit-${itemId}`));

    expect(capturedFormSheetProps.open).toBe(false);

    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(
      "collect.loadError",
      expect.objectContaining({ id: "collect-load-relations-error" })
    );
  });

  it("blocks Add when available-tricks query has errored (issue #218)", async () => {
    const { useQuery } = await import("@powersync/react");

    const availableTricksError = new Error("tricks query failed");
    vi.mocked(useQuery).mockImplementation((sql) => {
      if (sql === AVAILABLE_TRICKS_QUERY) {
        return {
          data: [],
          isLoading: false,
          isFetching: false,
          error: availableTricksError,
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
      screen.getByRole("button", { name: ADD_ITEM_PATTERN })
    );

    // Add path also blocks because the picker source is broken.
    expect(capturedFormSheetProps.open).toBe(false);

    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(
      "collect.loadError",
      expect.objectContaining({ id: "collect-load-relations-error" })
    );
  });

  it("does NOT block Add when only item_tags has errored (asymmetry, issue #218)", async () => {
    const { useQuery } = await import("@powersync/react");

    // item_tags errored, but availableTricks is healthy. Add path doesn't
    // depend on existing-relation joins — seedEmpty([]) is the intended
    // baseline.
    vi.mocked(useQuery).mockImplementation((sql) => {
      if (sql === ITEM_TAGS_QUERY) {
        return {
          data: [],
          isLoading: false,
          isFetching: false,
          error: new Error("item_tags broken"),
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
      screen.getByRole("button", { name: ADD_ITEM_PATTERN })
    );

    // Sheet OPENS — Add doesn't depend on join data.
    expect(capturedFormSheetProps.open).toBe(true);
    expect(capturedFormSheetProps.selectedTagIds).toEqual([]);
    expect(capturedFormSheetProps.selectedTrickIds).toEqual([]);
  });

  it("does NOT block Add when only item_tricks has errored (asymmetry, issue #218)", async () => {
    const { useQuery } = await import("@powersync/react");

    // item_tricks errored, but availableTricks is healthy. Mirror of the
    // item_tags-only Add test above — Add path doesn't gate on item-scoped
    // join failures because seedEmpty([]) is the intended baseline. The
    // mode-scoped close logic in collect-view.tsx (~line 292) only closes
    // Add when availableTricksError is set; item_tricks does NOT close.
    vi.mocked(useQuery).mockImplementation((sql) => {
      if (sql === ITEM_TRICKS_QUERY) {
        return {
          data: [],
          isLoading: false,
          isFetching: false,
          error: new Error("item_tricks broken"),
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
      screen.getByRole("button", { name: ADD_ITEM_PATTERN })
    );

    // Sheet OPENS — Add doesn't depend on item_tricks join.
    expect(capturedFormSheetProps.open).toBe(true);
    expect(capturedFormSheetProps.selectedTagIds).toEqual([]);
    expect(capturedFormSheetProps.selectedTrickIds).toEqual([]);
  });

  it("does NOT toast for brandsError (supplementary autocomplete)", async () => {
    const { useItemBrands } = await import("../hooks/use-item-brands");
    vi.mocked(useItemBrands).mockReturnValue({
      brands: [],
      error: new Error("brands offline"),
    });

    render(<CollectView />);

    await userEvent.click(
      screen.getByRole("button", { name: ADD_ITEM_PATTERN })
    );
    expect(capturedFormSheetProps.open).toBe(true);

    const { toast } = await import("sonner");
    expect(toast.error).not.toHaveBeenCalledWith(
      "collect.loadError",
      expect.objectContaining({ id: "collect-load-relations-error" })
    );
    expect(toast.error).not.toHaveBeenCalledWith(
      "collect.loadError",
      expect.objectContaining({ id: "collect-load-items-error" })
    );
  });

  it("does NOT toast for locationsError (supplementary autocomplete)", async () => {
    const { useItemLocations } = await import("../hooks/use-item-locations");
    const { useItems } = await import("../hooks/use-items");
    const { useItem } = await import("../hooks/use-item");
    const itemId = "00000000-0000-4000-8000-00000000218d";
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
    vi.mocked(useItemLocations).mockReturnValue({
      locations: [],
      error: new Error("locations offline"),
    });

    render(<CollectView />);

    await userEvent.click(screen.getByTestId(`edit-${itemId}`));

    expect(capturedFormSheetProps.open).toBe(true);

    const { toast } = await import("sonner");
    expect(toast.error).not.toHaveBeenCalledWith(
      "collect.loadError",
      expect.objectContaining({ id: "collect-load-relations-error" })
    );
  });

  it("auto-closes the sheet when a critical relation error fires after open", async () => {
    const { useItems } = await import("../hooks/use-items");
    const { useItem } = await import("../hooks/use-item");
    const { useQuery } = await import("@powersync/react");
    const itemId = "00000000-0000-4000-8000-00000000218e";
    const item = makeItem(itemId, "Cups and Balls");
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

    // Healthy initial state — sheet opens cleanly.
    vi.mocked(useQuery).mockImplementation(() => ({
      data: [],
      isLoading: false,
      isFetching: false,
      error: undefined,
    }));

    const { rerender } = render(<CollectView />);

    await userEvent.click(screen.getByTestId(`edit-${itemId}`));
    expect(capturedFormSheetProps.open).toBe(true);

    // Background sync surfaces a join error — Effect B should close the sheet.
    const tagJoinError = new Error("background sync drift");
    vi.mocked(useQuery).mockImplementation((sql) => {
      if (sql === ITEM_TAGS_QUERY) {
        return {
          data: [],
          isLoading: false,
          isFetching: false,
          error: tagJoinError,
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

    await waitFor(() => {
      expect(capturedFormSheetProps.open).toBe(false);
    });

    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(
      "collect.loadError",
      expect.objectContaining({ id: "collect-load-relations-error" })
    );
  });

  it("auto-closes the Add sheet when availableTricks errors after open", async () => {
    const { useQuery } = await import("@powersync/react");

    // Healthy initial state — Add sheet opens cleanly.
    vi.mocked(useQuery).mockImplementation(() => ({
      data: [],
      isLoading: false,
      isFetching: false,
      error: undefined,
    }));

    const { rerender } = render(<CollectView />);

    await userEvent.click(
      screen.getByRole("button", { name: ADD_ITEM_PATTERN })
    );
    expect(capturedFormSheetProps.open).toBe(true);

    // Background sync surfaces an availableTricks error — the mode-scoped
    // close effect should slam the Add sheet shut. In Add mode, only the
    // picker source (availableTricksError) triggers the close; item-scoped
    // joins do not.
    const availableTricksError = new Error("background tricks failure");
    vi.mocked(useQuery).mockImplementation((sql) => {
      if (sql === AVAILABLE_TRICKS_QUERY) {
        return {
          data: [],
          isLoading: false,
          isFetching: false,
          error: availableTricksError,
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

    await waitFor(() => {
      expect(capturedFormSheetProps.open).toBe(false);
    });

    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(
      "collect.loadError",
      expect.objectContaining({ id: "collect-load-relations-error" })
    );
  });

  // ---------------------------------------------------------------------------
  // Issue #263 — useTags() error swallowing
  // The picker source for tags. Unlike the item-scoped joins (gate Edit only),
  // tagError gates BOTH Add and Edit because the picker is rendered in both
  // flows. Mirrors the availableTricksError contract in #218.
  // ---------------------------------------------------------------------------

  it("blocks Edit when tags query has errored (issue #263)", async () => {
    const { useItems } = await import("../hooks/use-items");
    const { useTags } = await import("@/features/repertoire/hooks/use-tags");
    const itemId = "00000000-0000-4000-8000-000000000263";
    const item = makeItem(itemId, "Color Change");
    vi.mocked(useItems).mockReturnValue({
      items: [item],
      error: null,
      isLoading: false,
    });

    const tagsQueryError = new Error("tags table query failed");
    vi.mocked(useTags).mockReturnValue({
      tags: [],
      isLoading: false,
      error: tagsQueryError,
    });

    render(<CollectView />);

    await userEvent.click(screen.getByTestId(`edit-${itemId}`));

    expect(capturedFormSheetProps.open).toBe(false);
    // Discriminates handler-gate from auto-close: if the handler-entry guard
    // were dropped, the sheet would briefly open before the auto-close effect
    // slammed it shut, leaving `open === false` final but `true` in history.
    expect(formSheetOpenHistory).not.toContain(true);

    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(
      "collect.loadError",
      expect.objectContaining({ id: "collect-load-relations-error" })
    );
  });

  it("blocks Add when tags query has errored (issue #263)", async () => {
    const { useTags } = await import("@/features/repertoire/hooks/use-tags");

    const tagsQueryError = new Error("tags table query failed");
    vi.mocked(useTags).mockReturnValue({
      tags: [],
      isLoading: false,
      error: tagsQueryError,
    });

    render(<CollectView />);

    await userEvent.click(
      screen.getByRole("button", { name: ADD_ITEM_PATTERN })
    );

    // Add path also blocks because the tag picker source is broken.
    expect(capturedFormSheetProps.open).toBe(false);
    // Path-discriminates: confirms the handler-entry guard prevented open,
    // not just that the auto-close effect closed a briefly-open sheet.
    expect(formSheetOpenHistory).not.toContain(true);

    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(
      "collect.loadError",
      expect.objectContaining({ id: "collect-load-relations-error" })
    );
  });

  it("auto-closes the Edit sheet when tags errors after open (issue #263)", async () => {
    const { useItems } = await import("../hooks/use-items");
    const { useItem } = await import("../hooks/use-item");
    const { useTags } = await import("@/features/repertoire/hooks/use-tags");
    const itemId = "00000000-0000-4000-8000-000000000263e";
    const item = makeItem(itemId, "Sponge Balls");
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

    // Healthy initial state — Edit sheet opens cleanly.
    vi.mocked(useTags).mockReturnValue({
      tags: [],
      isLoading: false,
      error: null,
    });

    const { rerender } = render(<CollectView />);

    await userEvent.click(screen.getByTestId(`edit-${itemId}`));
    expect(capturedFormSheetProps.open).toBe(true);

    // Background sync surfaces a tags-query error — mode-scoped close should
    // slam the Edit sheet shut.
    const tagsQueryError = new Error("background tags drift");
    vi.mocked(useTags).mockReturnValue({
      tags: [],
      isLoading: false,
      error: tagsQueryError,
    });
    rerender(<CollectView />);

    await waitFor(() => {
      expect(capturedFormSheetProps.open).toBe(false);
    });

    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(
      "collect.loadError",
      expect.objectContaining({ id: "collect-load-relations-error" })
    );
  });

  it("auto-closes the Add sheet when tags errors after open (issue #263)", async () => {
    const { useTags } = await import("@/features/repertoire/hooks/use-tags");

    // Healthy initial state — Add sheet opens cleanly.
    vi.mocked(useTags).mockReturnValue({
      tags: [],
      isLoading: false,
      error: null,
    });

    const { rerender } = render(<CollectView />);

    await userEvent.click(
      screen.getByRole("button", { name: ADD_ITEM_PATTERN })
    );
    expect(capturedFormSheetProps.open).toBe(true);

    // Background sync surfaces a tags error — Add sheet must close because
    // tags is a picker source (gates both modes, unlike item-scoped joins).
    const tagsQueryError = new Error("background tags failure");
    vi.mocked(useTags).mockReturnValue({
      tags: [],
      isLoading: false,
      error: tagsQueryError,
    });
    rerender(<CollectView />);

    await waitFor(() => {
      expect(capturedFormSheetProps.open).toBe(false);
    });

    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(
      "collect.loadError",
      expect.objectContaining({ id: "collect-load-relations-error" })
    );
  });

  it("uses a stable toast id so re-renders dedupe (idempotency)", async () => {
    const { useQuery } = await import("@powersync/react");

    // Stable error ref held in closure — survives re-renders.
    const stableError = new Error("persistent schema drift");
    vi.mocked(useQuery).mockImplementation((sql) => {
      if (sql === ITEM_TAGS_QUERY) {
        return {
          data: [],
          isLoading: false,
          isFetching: false,
          error: stableError,
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

    const { toast } = await import("sonner");
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "collect.loadError",
        expect.objectContaining({ id: "collect-load-relations-error" })
      );
    });

    function countRelationsCalls(): number {
      return vi.mocked(toast.error).mock.calls.filter(([, opts]) => {
        if (!opts || typeof opts !== "object") {
          return false;
        }
        return (opts as { id?: string }).id === "collect-load-relations-error";
      }).length;
    }

    // Capture the call count after the initial render settles, then assert
    // bounded additive growth per rerender — each rerender may invoke the
    // effect at most once more (next-intl's `t` is not referentially stable
    // across renders, so deps change). Tighter than the prior bare `<= 4`:
    // growth is bounded relative to the baseline, so a regression that fires
    // multiple toasts per rerender fails here even though sonner dedups by id.
    const initialCount = countRelationsCalls();

    rerender(<CollectView />);
    expect(countRelationsCalls()).toBeLessThanOrEqual(initialCount + 1);

    rerender(<CollectView />);
    expect(countRelationsCalls()).toBeLessThanOrEqual(initialCount + 2);

    // Every relations toast call must carry the stable id and message.
    const allRelationsCalls = vi
      .mocked(toast.error)
      .mock.calls.filter(([, opts]) => {
        if (!opts || typeof opts !== "object") {
          return false;
        }
        return (opts as { id?: string }).id === "collect-load-relations-error";
      });
    expect(
      allRelationsCalls.every(([msg]) => msg === "collect.loadError")
    ).toBe(true);
  });

  it("auto-closes the sheet if a relation query errors mid-edit (issue #218)", async () => {
    const { useItems } = await import("../hooks/use-items");
    const { useItem } = await import("../hooks/use-item");
    const { useQuery } = await import("@powersync/react");
    const itemId = "00000000-0000-4000-8000-00000218e218";
    const item = makeItem(itemId, "Stage Saw");
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

    // All relation queries healthy — Edit must succeed in opening the sheet.
    vi.mocked(useQuery).mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: undefined,
    });

    const { rerender } = render(<CollectView />);
    await userEvent.click(screen.getByTestId(`edit-${itemId}`));

    await waitFor(() => {
      expect(capturedFormSheetProps.open).toBe(true);
    });

    // Flip item_tags to errored mid-session and rerender. The auto-close
    // effect must slam the sheet shut rather than let the user save against
    // a stale [] seed lock-in. Distinct from the entry-guard tests above:
    // those pre-mock the error before render so handleEditItem returns
    // early; this test exercises the useEffect path where the sheet has
    // already opened.
    const tagError = new Error("item_tags drifted mid-session");
    vi.mocked(useQuery).mockImplementation((sql) => {
      if (sql === ITEM_TAGS_QUERY) {
        return {
          data: [],
          isLoading: false,
          isFetching: false,
          error: tagError,
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

    await waitFor(() => {
      expect(capturedFormSheetProps.open).toBe(false);
    });

    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(
      "collect.loadError",
      expect.objectContaining({ id: "collect-load-relations-error" })
    );
  });
});
