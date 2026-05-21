import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TagId, TrickId } from "@/db/types";
import type { ParsedTrick, TrickWithTags } from "../types";
import {
  RepertoireView,
  TRICK_ITEMS_QUERY,
  TRICK_TAGS_QUERY,
  type TrickTagRow,
} from "./repertoire-view";
import type { TrickDeleteDialogProps } from "./trick-delete-dialog";
import type { TrickFiltersProps } from "./trick-filters";
import type { TrickFormSheetProps } from "./trick-form-sheet";

// Mock PowerSync — useQuery is used both directly in RepertoireView and in hooks
vi.mock("@powersync/react", () => ({
  useQuery: vi.fn(() => ({
    data: [],
    isLoading: false,
    isFetching: false,
    error: undefined,
  })),
  usePowerSync: vi.fn(() => ({ execute: vi.fn() })),
}));

// Mock Neon Auth
vi.mock("@neondatabase/auth/react", () => ({
  useSession: vi.fn(() => ({ data: { user: { id: "test-user-id" } } })),
}));

// Mock auth client used by mutations
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

// Mock all repertoire hooks at the feature level
vi.mock("../hooks/use-tricks", () => ({
  useTricks: vi.fn(() => ({ tricks: [], error: null, isLoading: false })),
}));

vi.mock("../hooks/use-trick", () => ({
  useTrick: vi.fn(() => ({
    trick: null,
    isLoading: false,
    error: null,
    hasSettled: false,
  })),
}));

vi.mock("../hooks/use-tags", () => ({
  useTags: vi.fn(() => ({ tags: [], isLoading: false, error: null })),
}));

const mockCreateTrick = vi.fn().mockResolvedValue("new-trick-id");
const mockUpdateTrick = vi.fn().mockResolvedValue(undefined);
const mockDeleteTrick = vi.fn().mockResolvedValue(undefined);

vi.mock("../hooks/use-trick-mutations", () => ({
  useTrickMutations: vi.fn(() => ({
    createTrick: mockCreateTrick,
    updateTrick: mockUpdateTrick,
    deleteTrick: mockDeleteTrick,
  })),
  // Real implementation is `null` for non-typed errors and an i18n key for
  // typed mutation errors. Tests reject with plain Error so null is correct.
  getMutationErrorKey: vi.fn(() => null),
}));

vi.mock("../hooks/use-tag-mutations", () => ({
  useTagMutations: vi.fn(() => ({
    createTag: vi.fn().mockResolvedValue("new-tag-id"),
  })),
}));

vi.mock("../hooks/use-trick-categories", () => ({
  useTrickCategories: vi.fn(() => ({ categories: [], error: null })),
}));

vi.mock("../hooks/use-trick-effect-types", () => ({
  useTrickEffectTypes: vi.fn(() => ({ effectTypes: [], error: null })),
}));

// TrickFormSheet mock — exposes callbacks for testing
let capturedFormSheetProps: Partial<TrickFormSheetProps> = {};
// Records every `open` value the mock has seen. Lets block-on-error tests
// distinguish "handler-gate prevented open" from "auto-close effect closed
// after a brief open" — they're indistinguishable from the final `open` prop
// alone. Reset in afterEach.
const formSheetOpenHistory: boolean[] = [];

vi.mock("./trick-form-sheet", () => ({
  TrickFormSheet: (props: TrickFormSheetProps) => {
    capturedFormSheetProps = props;
    formSheetOpenHistory.push(props.open);
    return (
      <div data-open={String(props.open)} data-testid="trick-form-sheet" />
    );
  },
}));

// TrickDeleteDialog mock — exposes callbacks for testing
let capturedDeleteDialogProps: Partial<TrickDeleteDialogProps> = {};

vi.mock("./trick-delete-dialog", () => ({
  TrickDeleteDialog: (props: TrickDeleteDialogProps) => {
    capturedDeleteDialogProps = props;
    return (
      <div data-open={String(props.open)} data-testid="trick-delete-dialog">
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

// TrickList mock — exposes edit/delete callbacks and captures tricks for assertions
let capturedTrickListTricks: TrickWithTags[] = [];

vi.mock("./trick-list", () => ({
  TrickList: ({
    tricks,
    onEdit,
    onDelete,
  }: {
    tricks: TrickWithTags[];
    onEdit: (id: TrickId) => void;
    onDelete: (id: TrickId) => void;
  }) => {
    capturedTrickListTricks = tricks;
    return (
      <div data-testid="trick-list">
        {tricks.map((trick) => (
          <div key={trick.id}>
            <span>{trick.name}</span>
            <button
              data-testid={`edit-${trick.id}`}
              onClick={() => onEdit(trick.id)}
              type="button"
            >
              Edit
            </button>
            <button
              data-testid={`delete-${trick.id}`}
              onClick={() => onDelete(trick.id)}
              type="button"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    );
  },
}));

vi.mock("./trick-empty-state", () => ({
  TrickEmptyState: ({ onAddTrick }: { onAddTrick: () => void }) => (
    <button data-testid="trick-empty-state" onClick={onAddTrick} type="button">
      Add your first trick
    </button>
  ),
}));

// TrickFilters mock — renders the search input (existing tests rely on it) and
// exposes onSortChange via a test button so we can cover the sort handler.
let capturedFiltersProps: Partial<TrickFiltersProps> = {};

vi.mock("./trick-filters", () => ({
  TrickFilters: (props: TrickFiltersProps) => {
    capturedFiltersProps = props;
    return (
      <div>
        <input
          aria-label="repertoire.searchPlaceholder"
          onChange={(e) => props.onSearchChange(e.target.value)}
          type="search"
          value={props.search}
        />
      </div>
    );
  },
}));

// Ensure fake timers are always cleaned up even if a test throws
afterEach(async () => {
  vi.useRealTimers();
  vi.clearAllMocks();

  // Reset hook mocks to defaults so no test leaks state
  const { useQuery } = await import("@powersync/react");
  const { useTricks } = await import("../hooks/use-tricks");
  const { useTrick } = await import("../hooks/use-trick");
  const { useTags } = await import("../hooks/use-tags");
  const { useTrickCategories } = await import("../hooks/use-trick-categories");
  const { useTrickEffectTypes } = await import(
    "../hooks/use-trick-effect-types"
  );

  vi.mocked(useQuery).mockReturnValue({
    data: [],
    isLoading: false,
    isFetching: false,
    error: undefined,
  });
  vi.mocked(useTricks).mockReturnValue({
    tricks: [],
    error: null,
    isLoading: false,
  });
  vi.mocked(useTrick).mockReturnValue({
    trick: null,
    isLoading: false,
    error: null,
    hasSettled: false,
  });
  vi.mocked(useTags).mockReturnValue({
    tags: [],
    isLoading: false,
    error: null,
  });
  vi.mocked(useTrickCategories).mockReturnValue({
    categories: [],
    error: null,
  });
  vi.mocked(useTrickEffectTypes).mockReturnValue({
    effectTypes: [],
    error: null,
  });

  // Restore mutation mock defaults (clearAllMocks strips implementations)
  mockCreateTrick.mockResolvedValue("new-trick-id");
  mockUpdateTrick.mockResolvedValue(undefined);
  mockDeleteTrick.mockResolvedValue(undefined);

  capturedFormSheetProps = {};
  formSheetOpenHistory.length = 0;
  capturedDeleteDialogProps = {};
  capturedFiltersProps = {};
  capturedTrickListTricks = [];
});

const ADD_TRICK_PATTERN = /repertoire.addTrick/i;

const makeTrick = (
  id: string,
  name: string,
  overrides: Partial<ParsedTrick> = {}
): ParsedTrick => ({
  id: id as TrickId,
  name,
  status: "new",
  difficulty: null,
  category: null,
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
  ...overrides,
});

/**
 * Seeds the trick_tags join query for the trick under edit, returning empty
 * data for every other SQL string. Mirrors collect-view's mockItemRelations.
 * Tags-only: the repertoire trick form has no trick/item selection. Ids need
 * not be UUID-shaped — buildTrickTagMap does not validate at the trust
 * boundary, unlike collect's buildItemTagMap.
 */
async function mockTrickRelations(opts: {
  trickId: string;
  tagIds?: TagId[];
}): Promise<void> {
  const { useQuery } = await import("@powersync/react");
  vi.mocked(useQuery).mockImplementation((sql) => {
    if (sql === TRICK_TAGS_QUERY) {
      return {
        data: (opts.tagIds ?? []).map(
          (tagId): TrickTagRow => ({
            trick_id: opts.trickId,
            tag_id: tagId,
            tag_name: `name-${tagId}`,
            color: null,
          })
        ),
        isLoading: false,
        isFetching: false,
        error: undefined,
      };
    }
    return { data: [], isLoading: false, isFetching: false, error: undefined };
  });
}

describe("RepertoireView", () => {
  it("renders without crashing", () => {
    render(<RepertoireView />);
    expect(screen.getByText("repertoire.title")).toBeInTheDocument();
  });

  it("renders the add trick button", () => {
    render(<RepertoireView />);
    expect(
      screen.getByRole("button", { name: ADD_TRICK_PATTERN })
    ).toBeInTheDocument();
  });

  it("shows empty state when there are no tricks and no filters", () => {
    render(<RepertoireView />);
    expect(screen.getByTestId("trick-empty-state")).toBeInTheDocument();
  });

  it("renders trick list when tricks are available", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    vi.mocked(useTricks).mockReturnValue({
      tricks: [makeTrick("trick-1", "Card Warp")],
      error: null,
      isLoading: false,
    });

    render(<RepertoireView />);
    expect(screen.getByTestId("trick-list")).toBeInTheDocument();
  });

  it("shows trick count in the header", () => {
    render(<RepertoireView />);
    expect(
      screen.getByText("repertoire.trickCount (count: 0)")
    ).toBeInTheDocument();
  });

  it("renders filter controls", () => {
    render(<RepertoireView />);
    expect(
      screen.getByRole("searchbox", { name: "repertoire.searchPlaceholder" })
    ).toBeInTheDocument();
  });

  it("opens sheet when add trick button is clicked", async () => {
    render(<RepertoireView />);
    await userEvent.click(
      screen.getByRole("button", { name: ADD_TRICK_PATTERN })
    );
    expect(capturedFormSheetProps.open).toBe(true);
    expect(capturedFormSheetProps.mode).toEqual({ mode: "create" });
  });

  it("opens sheet when empty state CTA is clicked", async () => {
    render(<RepertoireView />);
    await userEvent.click(screen.getByTestId("trick-empty-state"));
    expect(capturedFormSheetProps.open).toBe(true);
  });

  it("closes sheet via onOpenChange(false)", async () => {
    render(<RepertoireView />);
    // Open it first
    await userEvent.click(
      screen.getByRole("button", { name: ADD_TRICK_PATTERN })
    );
    // Verify open state is propagated — the attribute is set on the mock div
    expect(screen.getByTestId("trick-form-sheet")).toHaveAttribute(
      "data-open",
      "true"
    );
    // onOpenChange(false) exercises the close handler
    act(() => {
      capturedFormSheetProps.onOpenChange?.(false);
    });
    expect(screen.getByTestId("trick-form-sheet")).toHaveAttribute(
      "data-open",
      "false"
    );
  });

  it("calls createTrick on form submit for a new trick", async () => {
    render(<RepertoireView />);
    // Open the sheet
    await userEvent.click(
      screen.getByRole("button", { name: ADD_TRICK_PATTERN })
    );
    // Submit the form
    await capturedFormSheetProps.onSubmit?.({
      name: "New Trick",
      status: "new",
      description: "",
      category: "",
      effectType: "",
      difficulty: null,
      duration: null,
      performanceType: null,
      angleSensitivity: null,
      props: "",
      music: "",
      languages: [],
      isCameraFriendly: null,
      isSilent: null,
      source: "",
      videoUrl: "",
      notes: "",
    });
    expect(mockCreateTrick).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Trick", status: "new" }),
      []
    );
    const { toast } = await import("sonner");
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("repertoire.trickCreated");
    });
  });

  it("opens edit sheet when edit button is clicked on a trick", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    const { useTrick } = await import("../hooks/use-trick");
    const trick = makeTrick("trick-edit-1", "Silk Production");
    vi.mocked(useTricks).mockReturnValue({
      tricks: [trick],
      error: null,
      isLoading: false,
    });
    vi.mocked(useTrick).mockReturnValue({
      trick,
      isLoading: false,
      error: null,
      hasSettled: false,
    });

    render(<RepertoireView />);
    await userEvent.click(screen.getByTestId("edit-trick-edit-1"));
    expect(capturedFormSheetProps.open).toBe(true);
    expect(capturedFormSheetProps.mode).toEqual({ mode: "edit", trick });
  });

  it("opens delete dialog when delete button is clicked", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    vi.mocked(useTricks).mockReturnValue({
      tricks: [makeTrick("trick-del-1", "Vanish")],
      error: null,
      isLoading: false,
    });

    render(<RepertoireView />);
    await userEvent.click(screen.getByTestId("delete-trick-del-1"));
    expect(capturedDeleteDialogProps.open).toBe(true);
  });

  it("calls deleteTrick when delete is confirmed", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    vi.mocked(useTricks).mockReturnValue({
      tricks: [makeTrick("trick-del-2", "Coin Vanish")],
      error: null,
      isLoading: false,
    });

    render(<RepertoireView />);
    await userEvent.click(screen.getByTestId("delete-trick-del-2"));
    await userEvent.click(screen.getByTestId("confirm-delete"));
    expect(mockDeleteTrick).toHaveBeenCalledWith("trick-del-2");
    const { toast } = await import("sonner");
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("repertoire.trickDeleted");
    });
  });

  it("closes delete dialog via onOpenChange(false)", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    vi.mocked(useTricks).mockReturnValue({
      tricks: [makeTrick("trick-close-1", "Some Trick")],
      error: null,
      isLoading: false,
    });

    render(<RepertoireView />);
    await userEvent.click(screen.getByTestId("delete-trick-close-1"));
    expect(screen.getByTestId("confirm-delete")).toBeInTheDocument();
    // onOpenChange(false) exercises the close handler
    act(() => {
      capturedDeleteDialogProps.onOpenChange?.(false);
    });
    expect(screen.getByTestId("trick-delete-dialog")).toHaveAttribute(
      "data-open",
      "false"
    );
  });

  it("toggles a tag in add mode and tracks tagsDirty", async () => {
    render(<RepertoireView />);
    // Open sheet first
    await userEvent.click(
      screen.getByRole("button", { name: ADD_TRICK_PATTERN })
    );
    // Add mode, empty selection — not dirty.
    expect(capturedFormSheetProps.tagsDirty).toBe(false);

    // Toggle a tag — exercises handleToggleTag add path.
    act(() => {
      capturedFormSheetProps.onToggleTag?.("tag-1" as TagId);
    });
    expect(capturedFormSheetProps.selectedTagIds).toEqual(["tag-1"]);
    expect(capturedFormSheetProps.tagsDirty).toBe(true);

    // Toggle again to remove — exercises the filter branch and returns the
    // add-mode selection to empty, so tagsDirty flips back to false.
    act(() => {
      capturedFormSheetProps.onToggleTag?.("tag-1" as TagId);
    });
    expect(capturedFormSheetProps.selectedTagIds).toEqual([]);
    expect(capturedFormSheetProps.tagsDirty).toBe(false);
  });

  it("calls updateTrick when submitting the form in edit mode", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    const { useTrick } = await import("../hooks/use-trick");
    vi.mocked(useTricks).mockReturnValue({
      tricks: [makeTrick("trick-upd-1", "Silk Vanish")],
      error: null,
      isLoading: false,
    });
    vi.mocked(useTrick).mockReturnValue({
      trick: makeTrick("trick-upd-1", "Silk Vanish"),
      isLoading: false,
      error: null,
      hasSettled: false,
    });

    render(<RepertoireView />);
    // Click edit button
    await userEvent.click(screen.getByTestId("edit-trick-upd-1"));
    // Submit
    await capturedFormSheetProps.onSubmit?.({
      name: "Silk Vanish Updated",
      status: "learning",
      description: "",
      category: "",
      effectType: "",
      difficulty: null,
      duration: null,
      performanceType: null,
      angleSensitivity: null,
      props: "",
      music: "",
      languages: [],
      isCameraFriendly: null,
      isSilent: null,
      source: "",
      videoUrl: "",
      notes: "",
    });
    expect(mockUpdateTrick).toHaveBeenCalledWith(
      "trick-upd-1",
      expect.any(Object),
      expect.any(Array),
      expect.any(Array)
    );
    const { toast } = await import("sonner");
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("repertoire.trickUpdated");
    });
  });

  it("calls createTag via onCreateTag handler", async () => {
    const { useTagMutations } = await import("../hooks/use-tag-mutations");
    const mockCreateTag = vi.fn().mockResolvedValue("new-tag-123");
    vi.mocked(useTagMutations).mockReturnValue({ createTag: mockCreateTag });

    render(<RepertoireView />);
    await userEvent.click(
      screen.getByRole("button", { name: ADD_TRICK_PATTERN })
    );
    await capturedFormSheetProps.onCreateTag?.("Beginner");
    expect(mockCreateTag).toHaveBeenCalledWith("Beginner");
  });

  it("rethrows when createTag rejects so TagPicker can reset its state", async () => {
    // The wrapper logs and rethrows rather than swallowing — TagPicker owns
    // the user-facing toast and needs the rejection to reset its UI.
    const { useTagMutations } = await import("../hooks/use-tag-mutations");
    const failure = new Error("create failed");
    const mockCreateTag = vi.fn().mockRejectedValue(failure);
    vi.mocked(useTagMutations).mockReturnValue({ createTag: mockCreateTag });

    render(<RepertoireView />);
    await userEvent.click(
      screen.getByRole("button", { name: ADD_TRICK_PATTERN })
    );

    await expect(capturedFormSheetProps.onCreateTag?.("Beginner")).rejects.toBe(
      failure
    );
    expect(mockCreateTag).toHaveBeenCalledWith("Beginner");
  });

  it("updates search input value when user types", async () => {
    render(<RepertoireView />);
    await userEvent.type(
      screen.getByRole("searchbox", { name: "repertoire.searchPlaceholder" }),
      "nonexistent"
    );
    expect(
      screen.getByRole("searchbox", { name: "repertoire.searchPlaceholder" })
    ).toHaveValue("nonexistent");
  });

  it("computes tag add/remove diff when editing a trick", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    const { useTrick } = await import("../hooks/use-trick");

    const trick = makeTrick("trick-tags-1", "Tagged Trick");
    vi.mocked(useTricks).mockReturnValue({
      tricks: [trick],
      error: null,
      isLoading: false,
    });
    vi.mocked(useTrick).mockReturnValue({
      trick,
      isLoading: false,
      error: null,
      hasSettled: false,
    });
    await mockTrickRelations({
      trickId: "trick-tags-1",
      tagIds: ["tag-existing" as TagId],
    });

    render(<RepertoireView />);

    // Open edit mode — preloads tag-existing into selectedTagIds.
    await userEvent.click(screen.getByTestId("edit-trick-tags-1"));
    expect(capturedFormSheetProps.open).toBe(true);
    // Seed asserted — confirms hydration completed before the toggles below.
    expect(capturedFormSheetProps.selectedTagIds).toEqual(["tag-existing"]);

    // Remove the seeded tag, add a new one, then submit and assert the diff.
    act(() => {
      capturedFormSheetProps.onToggleTag?.("tag-existing" as TagId);
    });
    act(() => {
      capturedFormSheetProps.onToggleTag?.("tag-new" as TagId);
    });

    await capturedFormSheetProps.onSubmit?.({
      name: "Tagged Trick",
      status: "new",
      description: "",
      category: "",
      effectType: "",
      difficulty: null,
      duration: null,
      performanceType: null,
      angleSensitivity: null,
      props: "",
      music: "",
      languages: [],
      isCameraFriendly: null,
      isSilent: null,
      source: "",
      videoUrl: "",
      notes: "",
    });

    expect(mockUpdateTrick).toHaveBeenCalledWith(
      "trick-tags-1",
      expect.any(Object),
      ["tag-new"],
      ["tag-existing"]
    );
  });

  it("reports tagsDirty false when an edited trick's tags match the seed (issue #315)", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    const { useTrick } = await import("../hooks/use-trick");

    const seedTag = "tag-seed" as TagId;
    const trick = makeTrick("trick-dirty-1", "Tagged Trick");
    vi.mocked(useTricks).mockReturnValue({
      tricks: [trick],
      error: null,
      isLoading: false,
    });
    vi.mocked(useTrick).mockReturnValue({
      trick,
      isLoading: false,
      error: null,
      hasSettled: false,
    });
    await mockTrickRelations({ trickId: "trick-dirty-1", tagIds: [seedTag] });

    render(<RepertoireView />);
    await userEvent.click(screen.getByTestId("edit-trick-dirty-1"));

    // Seed asserted → hydration completed → the false below is meaningful
    // (not the indistinguishable during-hydration false).
    expect(capturedFormSheetProps.selectedTagIds).toEqual([seedTag]);
    expect(capturedFormSheetProps.tagsDirty).toBe(false);
  });

  it("flips tagsDirty true after a tag is changed in edit mode (issue #315)", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    const { useTrick } = await import("../hooks/use-trick");

    const seedTag = "tag-seed" as TagId;
    const trick = makeTrick("trick-dirty-2", "Tagged Trick");
    vi.mocked(useTricks).mockReturnValue({
      tricks: [trick],
      error: null,
      isLoading: false,
    });
    vi.mocked(useTrick).mockReturnValue({
      trick,
      isLoading: false,
      error: null,
      hasSettled: false,
    });
    await mockTrickRelations({ trickId: "trick-dirty-2", tagIds: [seedTag] });

    render(<RepertoireView />);
    await userEvent.click(screen.getByTestId("edit-trick-dirty-2"));

    // Seed asserted → hydration completed → a meaningful false baseline.
    expect(capturedFormSheetProps.selectedTagIds).toEqual([seedTag]);
    expect(capturedFormSheetProps.tagsDirty).toBe(false);

    // Adding a tag diverges the selection from the seed → dirty.
    act(() => {
      capturedFormSheetProps.onToggleTag?.("tag-added" as TagId);
    });
    expect(capturedFormSheetProps.tagsDirty).toBe(true);
  });

  it("updates sort when a valid sort value is provided via onSortChange", () => {
    render(<RepertoireView />);
    act(() => {
      capturedFiltersProps.onSortChange?.("name-asc");
    });
    expect(capturedFiltersProps.sort).toBe("name-asc");
  });

  it("ignores invalid sort values via onSortChange", () => {
    render(<RepertoireView />);
    // Set a valid sort first
    act(() => {
      capturedFiltersProps.onSortChange?.("name-asc");
    });
    // Trigger with an invalid value — exercises the guard branch that does nothing
    act(() => {
      capturedFiltersProps.onSortChange?.("invalid-sort");
    });
    // Sort should remain unchanged since invalid values are rejected
    expect(capturedFiltersProps.sort).toBe("name-asc");
  });

  it("shows no-results message when search is active after debounce", async () => {
    vi.useFakeTimers();

    render(<RepertoireView />);

    const searchBox = screen.getByRole("searchbox", {
      name: "repertoire.searchPlaceholder",
    });

    searchBox.focus();

    // Directly call onSearchChange on TrickFilters via the rendered search input
    fireEvent.change(searchBox, { target: { value: "nonexistent" } });

    // Advance past the 300ms debounce
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "repertoire.noResults"
    );
  });

  it("enriches tricks with tags from trick_tags join query", async () => {
    const { useQuery } = await import("@powersync/react");
    const { useTricks } = await import("../hooks/use-tricks");

    vi.mocked(useQuery).mockReturnValue({
      data: [
        {
          trick_id: "t1",
          tag_id: "tag-a",
          tag_name: "Cards",
          color: "#ff0000",
        },
        { trick_id: "t1", tag_id: "tag-b", tag_name: "Easy", color: null },
      ],
      isLoading: false,
      isFetching: false,
      error: undefined,
    });

    vi.mocked(useTricks).mockReturnValue({
      tricks: [makeTrick("t1", "Card Trick")],
      error: null,
      isLoading: false,
    });

    render(<RepertoireView />);

    expect(screen.getByTestId("trick-list")).toBeInTheDocument();
    expect(screen.getByText("Card Trick")).toBeInTheDocument();
    expect(capturedTrickListTricks[0]?.tags).toEqual([
      { id: "tag-a", name: "Cards", color: "#ff0000" },
      { id: "tag-b", name: "Easy", color: null },
    ]);
  });

  it("does nothing when confirm delete is called with no pending trick", async () => {
    render(<RepertoireView />);
    // Call onConfirm before any trick is marked for deletion (deletingTrickId is null)
    await expect(
      capturedDeleteDialogProps.onConfirm?.()
    ).resolves.toBeUndefined();
    expect(mockDeleteTrick).not.toHaveBeenCalled();
  });

  it("shows error toast when delete fails", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    vi.mocked(useTricks).mockReturnValue({
      tricks: [makeTrick("trick-del-fail", "Rope Trick")],
      error: null,
      isLoading: false,
    });
    mockDeleteTrick.mockRejectedValueOnce(new Error("delete failed"));

    render(<RepertoireView />);

    await userEvent.click(screen.getByTestId("delete-trick-del-fail"));
    await userEvent.click(screen.getByTestId("confirm-delete"));

    const { toast } = await import("sonner");
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("repertoire.deleteFailed");
    });
  });

  it("shows error toast when trick creation fails", async () => {
    mockCreateTrick.mockRejectedValueOnce(new Error("fail"));

    render(<RepertoireView />);

    await userEvent.click(
      screen.getByRole("button", { name: ADD_TRICK_PATTERN })
    );

    // The parent rethrows after toasting so the child TrickFormSheet sees the
    // failure and skips its post-await dirty reset (mirrors collect-view).
    await expect(
      capturedFormSheetProps.onSubmit?.({
        name: "Failing Trick",
        status: "new",
        description: "",
        category: "",
        effectType: "",
        difficulty: null,
        duration: null,
        performanceType: null,
        angleSensitivity: null,
        props: "",
        music: "",
        languages: [],
        isCameraFriendly: null,
        isSilent: null,
        source: "",
        videoUrl: "",
        notes: "",
      })
    ).rejects.toThrow("fail");

    const { toast } = await import("sonner");
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("repertoire.saveFailed");
    });
  });

  it("shows error toast when trick update fails", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    const { useTrick } = await import("../hooks/use-trick");

    vi.mocked(useTricks).mockReturnValue({
      tricks: [makeTrick("trick-fail-upd", "Coin Warp")],
      error: null,
      isLoading: false,
    });
    vi.mocked(useTrick).mockReturnValue({
      trick: makeTrick("trick-fail-upd", "Coin Warp"),
      isLoading: false,
      error: null,
      hasSettled: false,
    });
    mockUpdateTrick.mockRejectedValueOnce(new Error("update failed"));

    render(<RepertoireView />);

    await userEvent.click(screen.getByTestId("edit-trick-fail-upd"));

    await expect(
      capturedFormSheetProps.onSubmit?.({
        name: "Coin Warp",
        status: "learning",
        description: "",
        category: "",
        effectType: "",
        difficulty: null,
        duration: null,
        performanceType: null,
        angleSensitivity: null,
        props: "",
        music: "",
        languages: [],
        isCameraFriendly: null,
        isSilent: null,
        source: "",
        videoUrl: "",
        notes: "",
      })
    ).rejects.toThrow("update failed");

    const { toast } = await import("sonner");
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("repertoire.saveFailed");
    });
  });

  it("routes typed save errors through getMutationErrorKey to a specific toast", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    const { useTrick } = await import("../hooks/use-trick");
    const { getMutationErrorKey } = await import(
      "../hooks/use-trick-mutations"
    );

    vi.mocked(useTricks).mockReturnValue({
      tricks: [makeTrick("trick-typed-err", "Vanishing Coin")],
      error: null,
      isLoading: false,
    });
    vi.mocked(useTrick).mockReturnValue({
      trick: makeTrick("trick-typed-err", "Vanishing Coin"),
      isLoading: false,
      error: null,
      hasSettled: false,
    });

    const typedError = new Error("trick missing — typed");
    mockUpdateTrick.mockRejectedValueOnce(typedError);
    vi.mocked(getMutationErrorKey).mockReturnValueOnce("errors.trickMissing");

    render(<RepertoireView />);
    await userEvent.click(screen.getByTestId("edit-trick-typed-err"));

    await expect(
      capturedFormSheetProps.onSubmit?.(
        makeTrickFormValues({ name: "Vanishing Coin" })
      )
    ).rejects.toBe(typedError);

    expect(getMutationErrorKey).toHaveBeenCalledWith(typedError);

    const { toast } = await import("sonner");
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "repertoire.errors.trickMissing"
      );
    });
    // Generic fallback must not also fire when typed error is mapped.
    expect(toast.error).not.toHaveBeenCalledWith("repertoire.saveFailed");
  });

  it("routes typed delete errors through getMutationErrorKey to a specific toast", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    const { getMutationErrorKey } = await import(
      "../hooks/use-trick-mutations"
    );

    vi.mocked(useTricks).mockReturnValue({
      tricks: [makeTrick("trick-typed-del", "Linking Rings")],
      error: null,
      isLoading: false,
    });

    const typedError = new Error("trick missing — typed");
    mockDeleteTrick.mockRejectedValueOnce(typedError);
    vi.mocked(getMutationErrorKey).mockReturnValueOnce("errors.trickMissing");

    render(<RepertoireView />);
    await userEvent.click(screen.getByTestId("delete-trick-typed-del"));
    await userEvent.click(screen.getByTestId("confirm-delete"));

    expect(getMutationErrorKey).toHaveBeenCalledWith(typedError);

    const { toast } = await import("sonner");
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "repertoire.errors.trickMissing"
      );
    });
    expect(toast.error).not.toHaveBeenCalledWith("repertoire.deleteFailed");
  });

  it("closes sheet and clears edit state when useTrick reports an error", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    const { useTrick } = await import("../hooks/use-trick");
    const trickId = "00000000-0000-4000-8000-000000ed7e44";
    const trick = makeTrick(trickId, "Broken Trick");
    vi.mocked(useTricks).mockReturnValue({
      tricks: [trick],
      error: null,
      isLoading: false,
    });

    // useTrick reports an error — the sheet must NOT stay open on the
    // "add new" form when the edit target fails to hydrate.
    vi.mocked(useTrick).mockReturnValue({
      trick: null,
      error: new Error("load failed"),
      isLoading: false,
      hasSettled: false,
    });

    render(<RepertoireView />);

    // Attempt to open the edit sheet — the load-error effect should slam it shut.
    await userEvent.click(screen.getByTestId(`edit-${trickId}`));

    await waitFor(() => {
      expect(capturedFormSheetProps.open).toBe(false);
    });

    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(
      "repertoire.loadError",
      expect.objectContaining({ id: "repertoire-load-edit-trick-error" })
    );
  });

  // ---------------------------------------------------------------------------
  // Issue #216 — hydration-race regression coverage
  // ---------------------------------------------------------------------------

  // Helper for the trick-form's submit signature.
  const makeTrickFormValues = (overrides: Record<string, unknown> = {}) =>
    ({
      name: "Test",
      status: "new",
      description: "",
      category: "",
      effectType: "",
      difficulty: null,
      duration: null,
      performanceType: null,
      angleSensitivity: null,
      props: "",
      music: "",
      languages: [],
      isCameraFriendly: null,
      isSilent: null,
      source: "",
      videoUrl: "",
      notes: "",
      ...overrides,
    }) as Parameters<NonNullable<TrickFormSheetProps["onSubmit"]>>[0];

  // (Test D) Adjacent useTrick race: keyboard-submitting before the trick row
  // hydrates (trick===null) must not invoke updateTrick with RHF defaults.
  it("gates Save and short-circuits submit while useTrick is still loading (issue #216)", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    const { useTrick } = await import("../hooks/use-trick");

    const trickId = "00000000-0000-4000-8000-0000000ed216";
    const trick = makeTrick(trickId, "Card Warp");
    vi.mocked(useTricks).mockReturnValue({
      tricks: [trick],
      error: null,
      isLoading: false,
    });
    // useTrick reports isLoading: true — the row hasn't materialised yet.
    vi.mocked(useTrick).mockReturnValue({
      trick: null,
      error: null,
      isLoading: true,
      hasSettled: false,
    });

    const { rerender } = render(<RepertoireView />);

    await userEvent.click(screen.getByTestId(`edit-${trickId}`));
    expect(capturedFormSheetProps.relationsLoading).toBe(true);

    // Keyboard submit while still loading — defense in depth.
    await capturedFormSheetProps.onSubmit?.(
      makeTrickFormValues({ name: "Card Warp" })
    );
    expect(mockUpdateTrick).not.toHaveBeenCalled();

    // The block must surface a toast so the user knows submit was dropped.
    // Stable id so a follow-up rapid re-submit collapses the notification.
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(
      "repertoire.loadError",
      expect.objectContaining({ id: "repertoire-load-relations-error" })
    );

    // Hydrate the row.
    vi.mocked(useTrick).mockReturnValue({
      trick,
      error: null,
      isLoading: false,
      hasSettled: false,
    });
    rerender(<RepertoireView />);

    await waitFor(() => {
      expect(capturedFormSheetProps.relationsLoading).toBe(false);
    });

    // Now submit goes through.
    await capturedFormSheetProps.onSubmit?.(
      makeTrickFormValues({ name: "Card Warp" })
    );
    expect(mockUpdateTrick).toHaveBeenCalledWith(
      trickId,
      expect.any(Object),
      [],
      []
    );
  });

  // ---------------------------------------------------------------------------
  // Issue #217 — discriminated edit-target mode (create / loading / edit)
  // ---------------------------------------------------------------------------

  it("passes mode 'loading' to the sheet while the edit target is in flight", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    const { useTrick } = await import("../hooks/use-trick");
    const trickId = "00000000-0000-4000-8000-0000000ed217";
    const trick = makeTrick(trickId, "Miser's Dream");
    vi.mocked(useTricks).mockReturnValue({
      tricks: [trick],
      error: null,
      isLoading: false,
    });
    // Row query in flight — no row yet, isLoading true.
    vi.mocked(useTrick).mockReturnValue({
      trick: null,
      error: null,
      isLoading: true,
      hasSettled: false,
    });

    const { rerender } = render(<RepertoireView />);
    await userEvent.click(screen.getByTestId(`edit-${trickId}`));

    // Intent is "edit", but the row hasn't hydrated — sheet shows loading mode,
    // never "Add" (issue #217).
    expect(capturedFormSheetProps.open).toBe(true);
    expect(capturedFormSheetProps.mode).toEqual({ mode: "loading" });
    // Production safety invariant: mode:"loading" always coincides with
    // relationsLoading:true (the same in-flight row drives both), so Save
    // stays disabled while the edit target hydrates.
    expect(capturedFormSheetProps.relationsLoading).toBe(true);
    // A genuinely in-flight row (null + isLoading) must NOT trip the
    // settledMissing close path — lock the negative branch so a regression
    // that mis-fires the close+toast while the query is still loading fails.
    const { toast } = await import("sonner");
    expect(toast.error).not.toHaveBeenCalledWith(
      "repertoire.trickNoLongerExists",
      expect.anything()
    );

    // Row settles — mode flips to "edit" with the resolved trick.
    vi.mocked(useTrick).mockReturnValue({
      trick,
      error: null,
      isLoading: false,
      hasSettled: false,
    });
    rerender(<RepertoireView />);
    await waitFor(() => {
      expect(capturedFormSheetProps.mode).toEqual({ mode: "edit", trick });
    });
  });

  it("keeps mode 'edit' through an isFetching flicker mid-edit-session (issue #217)", async () => {
    // Steady edit session: useTrick returns the matching trick but isLoading
    // is true — PowerSync's isFetching flickered on an unrelated tricks-table
    // re-emit. deriveSheetMode keys on row identity, not isLoading, so mode
    // stays "edit" — TrickForm is NOT unmounted and typed text is preserved.
    const { useTricks } = await import("../hooks/use-tricks");
    const { useTrick } = await import("../hooks/use-trick");
    const trickId = "00000000-0000-4000-8000-0000000ed21f";
    const trick = makeTrick(trickId, "Ambitious Card");
    vi.mocked(useTricks).mockReturnValue({
      tricks: [trick],
      error: null,
      isLoading: false,
    });
    // Trick present AND id matches editingTrickId, but isLoading true.
    vi.mocked(useTrick).mockReturnValue({
      trick,
      isLoading: true,
      error: null,
      hasSettled: false,
    });

    render(<RepertoireView />);
    await userEvent.click(screen.getByTestId(`edit-${trickId}`));

    // Mode must NOT drop to { mode: "loading" } — that would remount the form.
    expect(capturedFormSheetProps.mode).toEqual({ mode: "edit", trick });
    // trick_tags join (default useQuery mock) returns [] and settles, so the
    // hydrated-selection hook is not hydrating — Save is not gated.
    expect(capturedFormSheetProps.relationsLoading).toBe(false);
  });

  it("keeps mode 'loading' when useTrick still holds the previous edit target's row", async () => {
    // Edit→Edit target switch: editingTrickId is B, but useWatchedQuery can
    // still report the prior query's row (A) for one frame. deriveSheetMode
    // keys on row id, not isLoading — a stale row reads as "loading", never
    // "edit" with the wrong trick (issue #217 identity gate).
    const { useTricks } = await import("../hooks/use-tricks");
    const { useTrick } = await import("../hooks/use-trick");
    const idA = "00000000-0000-4000-8000-0000000ed21a";
    const idB = "00000000-0000-4000-8000-0000000ed21b";
    const trickA = makeTrick(idA, "Miser's Dream");
    const trickB = makeTrick(idB, "Card to Pocket");
    vi.mocked(useTricks).mockReturnValue({
      tricks: [trickA, trickB],
      error: null,
      isLoading: false,
    });
    // Stale: the query param is now B, but the resolved row is still A.
    // hasSettled is TRUE on purpose — this exercises the identity gate:
    // settledMissing requires editingTrick === null AND hasSettled. Setting
    // hasSettled: false would gate it independently and the test would
    // pass even if the identity check (editingTrick === null) regressed.
    vi.mocked(useTrick).mockReturnValue({
      trick: trickA,
      error: null,
      isLoading: false,
      hasSettled: true,
    });

    render(<RepertoireView />);
    await userEvent.click(screen.getByTestId(`edit-${idB}`));

    expect(capturedFormSheetProps.open).toBe(true);
    expect(capturedFormSheetProps.mode).toEqual({ mode: "loading" });
    // A stale non-null row must still gate Save — the loaded selections are
    // for the previous trick, not the one being edited.
    expect(capturedFormSheetProps.relationsLoading).toBe(true);
    // The whole point of the identity gate: a stale (non-null) row must NOT
    // trip the settledMissing close path. Lock the negative branch so a
    // regression that mis-fires settledMissing on a stale row fails here.
    const { toast } = await import("sonner");
    expect(toast.error).not.toHaveBeenCalledWith(
      "repertoire.trickNoLongerExists",
      expect.anything()
    );
  });

  it("closes the edit sheet when the trick row settles with no match", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    const { useTrick } = await import("../hooks/use-trick");
    const trickId = "00000000-0000-4000-8000-0000000ed218";
    vi.mocked(useTricks).mockReturnValue({
      tricks: [makeTrick(trickId, "Vanished")],
      error: null,
      isLoading: false,
    });
    // Query settled (isLoading false, hasSettled true) but no row — the trick
    // was deleted out from under the user. The sheet must close, not hang on
    // a skeleton.
    vi.mocked(useTrick).mockReturnValue({
      trick: null,
      error: null,
      isLoading: false,
      hasSettled: true,
    });

    render(<RepertoireView />);
    await userEvent.click(screen.getByTestId(`edit-${trickId}`));

    await waitFor(() => {
      expect(capturedFormSheetProps.open).toBe(false);
    });
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(
      "repertoire.trickNoLongerExists",
      expect.objectContaining({ id: "repertoire-trick-no-longer-exists" })
    );
  });

  // Issue #287 regression — settledMissing must fire on the sync-churn
  // scenario even when the folded isLoading flickers true on unrelated
  // `tricks`-table re-emits. The old gate (`!editingTrickLoading`) would
  // delay the close+toast unreliably; the new gate (`editingTrickSettled`)
  // is sticky once the query has settled at least once for the current id.
  it("closes the edit sheet on settled-missing even during an isFetching flicker (issue #287)", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    const { useTrick } = await import("../hooks/use-trick");
    const trickId = "00000000-0000-4000-8000-0000000ed218";
    vi.mocked(useTricks).mockReturnValue({
      tricks: [makeTrick(trickId, "Vanished")],
      error: null,
      isLoading: false,
    });
    // Sync churn: an unrelated `tricks` row updated → useWatchedQuery
    // re-runs → isFetching:true flickers → folded isLoading is true.
    // hasSettled is true because the query previously settled at least
    // once for this id. The settledMissing close+toast MUST fire here;
    // the pre-#287 code would block on `!editingTrickLoading`.
    vi.mocked(useTrick).mockReturnValue({
      trick: null,
      error: null,
      isLoading: true,
      hasSettled: true,
    });

    render(<RepertoireView />);
    await userEvent.click(screen.getByTestId(`edit-${trickId}`));

    await waitFor(() => {
      expect(capturedFormSheetProps.open).toBe(false);
    });
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(
      "repertoire.trickNoLongerExists",
      expect.objectContaining({ id: "repertoire-trick-no-longer-exists" })
    );
  });

  // (Test F) Add path is never gated — relationsLoading must be false even
  // when the tag-join query is still loading, because handleAddTrick seeds
  // [] up front via tagsSel.seedEmpty().
  it("does not gate the Add path while joins are loading", async () => {
    const { useQuery } = await import("@powersync/react");
    vi.mocked(useQuery).mockReturnValue({
      data: [],
      isLoading: true,
      isFetching: true,
      error: undefined,
    });

    render(<RepertoireView />);

    await userEvent.click(
      screen.getByRole("button", { name: ADD_TRICK_PATTERN })
    );

    expect(capturedFormSheetProps.open).toBe(true);
    expect(capturedFormSheetProps.relationsLoading).toBe(false);
    expect(capturedFormSheetProps.selectedTagIds).toEqual([]);

    // Submit while joins are still isLoading: true. The Add path is NOT
    // gated, so createTrick must run with an empty tag array. A regression
    // that wraps the create branch in a relationsLoading guard would skip
    // the call here and fail this assertion.
    await capturedFormSheetProps.onSubmit?.(
      makeTrickFormValues({ name: "New Trick" })
    );
    expect(mockCreateTrick).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Trick" }),
      []
    );
  });

  // ---------------------------------------------------------------------------
  // Issue #218 — silent join-query failures
  // ---------------------------------------------------------------------------

  it("blocks Edit when trick_tags query has errored (issue #218)", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    const { useQuery } = await import("@powersync/react");
    const trickId = "00000000-0000-4000-8000-00000000218a";
    vi.mocked(useTricks).mockReturnValue({
      tricks: [makeTrick(trickId, "Card Force")],
      error: null,
      isLoading: false,
    });

    const tagJoinError = new Error("trick_tags schema drift");
    vi.mocked(useQuery).mockImplementation((sql) => {
      if (sql === TRICK_TAGS_QUERY) {
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

    render(<RepertoireView />);

    await userEvent.click(screen.getByTestId(`edit-${trickId}`));

    expect(capturedFormSheetProps.open).toBe(false);

    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(
      "repertoire.loadError",
      expect.objectContaining({ id: "repertoire-load-relations-error" })
    );
  });

  it("does NOT block Edit when only trick_items has errored (asymmetry, issue #218)", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    const { useTrick } = await import("../hooks/use-trick");
    const { useQuery } = await import("@powersync/react");
    const trickId = "00000000-0000-4000-8000-00000000218b";
    const trick = makeTrick(trickId, "Coin Vanish");
    vi.mocked(useTricks).mockReturnValue({
      tricks: [trick],
      error: null,
      isLoading: false,
    });
    vi.mocked(useTrick).mockReturnValue({
      trick,
      isLoading: false,
      error: null,
      hasSettled: false,
    });

    const itemJoinError = new Error("item_tricks parse error");
    vi.mocked(useQuery).mockImplementation((sql) => {
      // trickItemError SQL pulls from item_tricks; trick_tags is healthy.
      if (sql === TRICK_ITEMS_QUERY) {
        return {
          data: [],
          isLoading: false,
          isFetching: false,
          error: itemJoinError,
        };
      }
      return {
        data: [],
        isLoading: false,
        isFetching: false,
        error: undefined,
      };
    });

    render(<RepertoireView />);

    await userEvent.click(screen.getByTestId(`edit-${trickId}`));

    // Sheet OPENS — trickItemError feeds only the inverse-relation display
    // (TrickList badges), never the edit form. Toast still fires so the
    // user knows the list is incomplete.
    expect(capturedFormSheetProps.open).toBe(true);

    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(
      "repertoire.loadError",
      expect.objectContaining({ id: "repertoire-load-relations-error" })
    );
  });

  it("does NOT block Add when trick_tags has errored (asymmetry, issue #218)", async () => {
    const { useQuery } = await import("@powersync/react");

    vi.mocked(useQuery).mockImplementation((sql) => {
      if (sql === TRICK_TAGS_QUERY) {
        return {
          data: [],
          isLoading: false,
          isFetching: false,
          error: new Error("trick_tags broken"),
        };
      }
      return {
        data: [],
        isLoading: false,
        isFetching: false,
        error: undefined,
      };
    });

    render(<RepertoireView />);

    await userEvent.click(
      screen.getByRole("button", { name: ADD_TRICK_PATTERN })
    );

    // Add path doesn't depend on join data — sheet OPENS.
    expect(capturedFormSheetProps.open).toBe(true);
    expect(capturedFormSheetProps.selectedTagIds).toEqual([]);
  });

  it("auto-closes the EDIT sheet when trick_tags errors after open", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    const { useTrick } = await import("../hooks/use-trick");
    const { useQuery } = await import("@powersync/react");
    const trickId = "00000000-0000-4000-8000-00000000218c";
    const trick = makeTrick(trickId, "Sponge Bunny");
    vi.mocked(useTricks).mockReturnValue({
      tricks: [trick],
      error: null,
      isLoading: false,
    });
    vi.mocked(useTrick).mockReturnValue({
      trick,
      isLoading: false,
      error: null,
      hasSettled: false,
    });

    // Healthy initial state.
    vi.mocked(useQuery).mockImplementation(() => ({
      data: [],
      isLoading: false,
      isFetching: false,
      error: undefined,
    }));

    const { rerender } = render(<RepertoireView />);

    await userEvent.click(screen.getByTestId(`edit-${trickId}`));
    expect(capturedFormSheetProps.open).toBe(true);

    // Background sync surfaces a trick_tags error.
    const tagJoinError = new Error("background sync drift");
    vi.mocked(useQuery).mockImplementation((sql) => {
      if (sql === TRICK_TAGS_QUERY) {
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
    rerender(<RepertoireView />);

    await waitFor(() => {
      expect(capturedFormSheetProps.open).toBe(false);
    });
  });

  it("does NOT auto-close the ADD sheet when trick_tags errors after open", async () => {
    const { useQuery } = await import("@powersync/react");

    // Healthy initial state.
    vi.mocked(useQuery).mockImplementation(() => ({
      data: [],
      isLoading: false,
      isFetching: false,
      error: undefined,
    }));

    const { rerender } = render(<RepertoireView />);

    // Open the Add sheet (no editing target).
    await userEvent.click(
      screen.getByRole("button", { name: ADD_TRICK_PATTERN })
    );
    expect(capturedFormSheetProps.open).toBe(true);
    expect(capturedFormSheetProps.mode).toEqual({ mode: "create" });

    // Background trick_tags error fires — Add mode must remain open.
    const tagJoinError = new Error("background sync drift");
    vi.mocked(useQuery).mockImplementation((sql) => {
      if (sql === TRICK_TAGS_QUERY) {
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
    rerender(<RepertoireView />);

    // Toast fires (page-level effect always toasts), but Add sheet stays open.
    expect(capturedFormSheetProps.open).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Issue #263 sibling — useTricks() list error must surface to the user.
  // Mirrors collect-view's items-list error toast (LOAD_ITEMS_ERROR_TOAST_ID).
  // ---------------------------------------------------------------------------

  it("fires a load-error toast with a stable id when tricks query fails", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    vi.mocked(useTricks).mockReturnValue({
      tricks: [],
      error: new Error("boom"),
      isLoading: false,
    });

    render(<RepertoireView />);

    const { toast } = await import("sonner");
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "repertoire.loadError",
        expect.objectContaining({ id: "repertoire-load-tricks-error" })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Issue #263 — useTags() error swallowing
  // The picker source for tags. Unlike trickTagError (junction, gates Edit
  // only — Add doesn't seed from existing relations), tagError gates BOTH Add
  // and Edit because the tag picker is rendered in both flows.
  // ---------------------------------------------------------------------------

  it("blocks Edit when tags query has errored (issue #263)", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    const { useTags } = await import("../hooks/use-tags");
    const trickId = "00000000-0000-4000-8000-000000000263";
    const trick = makeTrick(trickId, "Card Force");
    vi.mocked(useTricks).mockReturnValue({
      tricks: [trick],
      error: null,
      isLoading: false,
    });

    const tagsQueryError = new Error("tags table query failed");
    vi.mocked(useTags).mockReturnValue({
      tags: [],
      isLoading: false,
      error: tagsQueryError,
    });

    render(<RepertoireView />);

    await userEvent.click(screen.getByTestId(`edit-${trickId}`));

    expect(capturedFormSheetProps.open).toBe(false);
    // Discriminates handler-gate from auto-close: if the handler-entry guard
    // were dropped, the sheet would briefly open before the auto-close effect
    // slammed it shut, leaving `open === false` final but `true` in history.
    expect(formSheetOpenHistory).not.toContain(true);

    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(
      "repertoire.loadError",
      expect.objectContaining({ id: "repertoire-load-relations-error" })
    );
  });

  it("blocks Add when tags query has errored (issue #263)", async () => {
    const { useTags } = await import("../hooks/use-tags");

    const tagsQueryError = new Error("tags table query failed");
    vi.mocked(useTags).mockReturnValue({
      tags: [],
      isLoading: false,
      error: tagsQueryError,
    });

    render(<RepertoireView />);

    await userEvent.click(
      screen.getByRole("button", { name: ADD_TRICK_PATTERN })
    );

    // Contrast with trickTagError: Add path DOES gate on tagError because
    // the picker source is shared between Add and Edit.
    expect(capturedFormSheetProps.open).toBe(false);
    // Path-discriminates: confirms the handler-entry guard prevented open,
    // not just that the auto-close effect closed a briefly-open sheet.
    expect(formSheetOpenHistory).not.toContain(true);

    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(
      "repertoire.loadError",
      expect.objectContaining({ id: "repertoire-load-relations-error" })
    );
  });

  it("auto-closes the EDIT sheet when tags errors after open (issue #263)", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    const { useTrick } = await import("../hooks/use-trick");
    const { useTags } = await import("../hooks/use-tags");
    const trickId = "00000000-0000-4000-8000-000000000263e";
    const trick = makeTrick(trickId, "Sponge Balls");
    vi.mocked(useTricks).mockReturnValue({
      tricks: [trick],
      error: null,
      isLoading: false,
    });
    vi.mocked(useTrick).mockReturnValue({
      trick,
      isLoading: false,
      error: null,
      hasSettled: false,
    });

    // Healthy initial state — Edit sheet opens cleanly.
    vi.mocked(useTags).mockReturnValue({
      tags: [],
      isLoading: false,
      error: null,
    });

    const { rerender } = render(<RepertoireView />);

    await userEvent.click(screen.getByTestId(`edit-${trickId}`));
    expect(capturedFormSheetProps.open).toBe(true);

    // Background sync surfaces a tags-query error.
    const tagsQueryError = new Error("background tags drift");
    vi.mocked(useTags).mockReturnValue({
      tags: [],
      isLoading: false,
      error: tagsQueryError,
    });
    rerender(<RepertoireView />);

    await waitFor(() => {
      expect(capturedFormSheetProps.open).toBe(false);
    });

    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(
      "repertoire.loadError",
      expect.objectContaining({ id: "repertoire-load-relations-error" })
    );
  });

  it("auto-closes the ADD sheet when tags errors after open (issue #263)", async () => {
    const { useTags } = await import("../hooks/use-tags");

    // Healthy initial state — Add sheet opens cleanly.
    vi.mocked(useTags).mockReturnValue({
      tags: [],
      isLoading: false,
      error: null,
    });

    const { rerender } = render(<RepertoireView />);

    await userEvent.click(
      screen.getByRole("button", { name: ADD_TRICK_PATTERN })
    );
    expect(capturedFormSheetProps.open).toBe(true);

    // Background tags error fires — Add sheet must close because tags is a
    // picker source (gates both modes). Contrast with the trickTagError test
    // immediately above, where Add stays open.
    const tagsQueryError = new Error("background tags failure");
    vi.mocked(useTags).mockReturnValue({
      tags: [],
      isLoading: false,
      error: tagsQueryError,
    });
    rerender(<RepertoireView />);

    await waitFor(() => {
      expect(capturedFormSheetProps.open).toBe(false);
    });

    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(
      "repertoire.loadError",
      expect.objectContaining({ id: "repertoire-load-relations-error" })
    );
  });

  // ---------------------------------------------------------------------------
  // Issue #263 — supplementary autocomplete queries must NOT toast.
  // categories/effect-types feed combobox suggestions only; the form has
  // hardcoded SUGGESTED_* fallbacks. Mirrors brandsError/locationsError in
  // collect-view. Guards against a future "fix" that adds toast.error to the
  // supplementary effect.
  // ---------------------------------------------------------------------------

  it("does NOT toast for categoriesError (supplementary autocomplete)", async () => {
    const { useTrickCategories } = await import(
      "../hooks/use-trick-categories"
    );
    vi.mocked(useTrickCategories).mockReturnValue({
      categories: [],
      error: new Error("categories offline"),
    });

    render(<RepertoireView />);

    await userEvent.click(
      screen.getByRole("button", { name: ADD_TRICK_PATTERN })
    );
    expect(capturedFormSheetProps.open).toBe(true);

    const { toast } = await import("sonner");
    expect(toast.error).not.toHaveBeenCalledWith(
      "repertoire.loadError",
      expect.objectContaining({ id: "repertoire-load-relations-error" })
    );
  });

  it("does NOT toast for effectTypesError (supplementary autocomplete)", async () => {
    const { useTrickEffectTypes } = await import(
      "../hooks/use-trick-effect-types"
    );
    vi.mocked(useTrickEffectTypes).mockReturnValue({
      effectTypes: [],
      error: new Error("effect types offline"),
    });

    render(<RepertoireView />);

    await userEvent.click(
      screen.getByRole("button", { name: ADD_TRICK_PATTERN })
    );
    expect(capturedFormSheetProps.open).toBe(true);

    const { toast } = await import("sonner");
    expect(toast.error).not.toHaveBeenCalledWith(
      "repertoire.loadError",
      expect.objectContaining({ id: "repertoire-load-relations-error" })
    );
  });

  it("uses a stable toast id so re-renders dedupe (idempotency)", async () => {
    const { useQuery } = await import("@powersync/react");

    const stableError = new Error("persistent schema drift");
    vi.mocked(useQuery).mockImplementation((sql) => {
      if (sql === TRICK_TAGS_QUERY) {
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

    const { rerender } = render(<RepertoireView />);

    const { toast } = await import("sonner");
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "repertoire.loadError",
        expect.objectContaining({ id: "repertoire-load-relations-error" })
      );
    });

    // Capture the call count after the initial effect has settled, then
    // assert linear-bounded growth across rerenders. Each rerender refires
    // the effect once (the `t` translator identity changes per render in
    // the next-intl test mock, which is on the effect's dep list), so the
    // count must grow by at most 1 per rerender — never more. A regression
    // that, say, drops the stable error reference inside the effect would
    // compound (every state-change triggers another render which fires the
    // effect again, which sets a fresh ref…), breaching this bound.
    const relationsErrorCount = () =>
      vi.mocked(toast.error).mock.calls.filter(([, opts]) => {
        if (!opts || typeof opts !== "object") {
          return false;
        }
        return (
          (opts as { id?: string }).id === "repertoire-load-relations-error"
        );
      }).length;

    const initialCount = relationsErrorCount();

    rerender(<RepertoireView />);
    expect(relationsErrorCount()).toBeLessThanOrEqual(initialCount + 1);

    rerender(<RepertoireView />);
    expect(relationsErrorCount()).toBeLessThanOrEqual(initialCount + 2);

    // Every relations-toast call must carry the stable message + id.
    const relationsCalls = vi
      .mocked(toast.error)
      .mock.calls.filter(([, opts]) => {
        if (!opts || typeof opts !== "object") {
          return false;
        }
        return (
          (opts as { id?: string }).id === "repertoire-load-relations-error"
        );
      });
    expect(
      relationsCalls.every(([msg]) => msg === "repertoire.loadError")
    ).toBe(true);
  });

  it("auto-closes the sheet if trick_tags errors mid-edit (issue #218)", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    const { useTrick } = await import("../hooks/use-trick");
    const { useQuery } = await import("@powersync/react");
    const trickId = "00000000-0000-4000-8000-00000218e218";
    const trick = makeTrick(trickId, "Card Warp");
    vi.mocked(useTricks).mockReturnValue({
      tricks: [trick],
      error: null,
      isLoading: false,
    });
    vi.mocked(useTrick).mockReturnValue({
      trick,
      error: null,
      isLoading: false,
      hasSettled: false,
    });

    // All relation queries healthy — Edit must succeed in opening the sheet.
    vi.mocked(useQuery).mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: undefined,
    });

    const { rerender } = render(<RepertoireView />);
    await userEvent.click(screen.getByTestId(`edit-${trickId}`));

    await waitFor(() => {
      expect(capturedFormSheetProps.open).toBe(true);
    });

    // Flip trick_tags to errored mid-session and rerender. The auto-close
    // effect must close the sheet — without trick_tags the seed lock-in
    // would be empty and the user can't see what they have or remove what
    // they've toggled. Distinct from the entry-guard tests above: those
    // pre-mock the error before render so handleEditTrick returns early;
    // this exercises the useEffect path where the sheet has already opened.
    // trickItemError is intentionally NOT exercised here — the asymmetric
    // case (sheet stays open) is covered separately.
    const tagError = new Error("trick_tags drifted mid-session");
    vi.mocked(useQuery).mockImplementation((sql) => {
      if (sql === TRICK_TAGS_QUERY) {
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
    rerender(<RepertoireView />);

    await waitFor(() => {
      expect(capturedFormSheetProps.open).toBe(false);
    });

    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith(
      "repertoire.loadError",
      expect.objectContaining({ id: "repertoire-load-relations-error" })
    );
  });
});
