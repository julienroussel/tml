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
import { RepertoireView } from "./repertoire-view";
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
  useTrick: vi.fn(() => ({ trick: null, isLoading: false })),
}));

vi.mock("../hooks/use-tags", () => ({
  useTags: vi.fn(() => ({ tags: [], isLoading: false })),
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
}));

vi.mock("../hooks/use-tag-mutations", () => ({
  useTagMutations: vi.fn(() => ({
    createTag: vi.fn().mockResolvedValue("new-tag-id"),
  })),
}));

vi.mock("../hooks/use-trick-categories", () => ({
  useTrickCategories: vi.fn(() => []),
}));

vi.mock("../hooks/use-trick-effect-types", () => ({
  useTrickEffectTypes: vi.fn(() => []),
}));

// TrickFormSheet mock — exposes callbacks for testing
let capturedFormSheetProps: Partial<TrickFormSheetProps> = {};

vi.mock("./trick-form-sheet", () => ({
  TrickFormSheet: (props: TrickFormSheetProps) => {
    capturedFormSheetProps = props;
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
  vi.mocked(useTrick).mockReturnValue({ trick: null, isLoading: false });

  // Restore mutation mock defaults (clearAllMocks strips implementations)
  mockCreateTrick.mockResolvedValue("new-trick-id");
  mockUpdateTrick.mockResolvedValue(undefined);
  mockDeleteTrick.mockResolvedValue(undefined);

  capturedFormSheetProps = {};
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
    expect(capturedFormSheetProps.trick).toBeNull();
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
    vi.mocked(useTricks).mockReturnValue({
      tricks: [makeTrick("trick-edit-1", "Silk Production")],
      error: null,
      isLoading: false,
    });

    render(<RepertoireView />);
    await userEvent.click(screen.getByTestId("edit-trick-edit-1"));
    expect(capturedFormSheetProps.open).toBe(true);
    expect(capturedFormSheetProps.trick).toBeDefined();
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

  it("toggles a tag via onToggleTag without throwing", async () => {
    render(<RepertoireView />);
    // Open sheet first
    await userEvent.click(
      screen.getByRole("button", { name: ADD_TRICK_PATTERN })
    );
    // Toggle a tag — exercises handleToggleTag add path
    act(() => {
      capturedFormSheetProps.onToggleTag?.("tag-1" as TagId);
    });
    expect(capturedFormSheetProps.selectedTagIds).toEqual(["tag-1"]);

    // Toggle again to remove — exercises the filter branch
    act(() => {
      capturedFormSheetProps.onToggleTag?.("tag-1" as TagId);
    });
    expect(capturedFormSheetProps.selectedTagIds).toEqual([]);
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

  it("computes tagsDirty correctly when editing a trick with changed tags", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    const { useTrick } = await import("../hooks/use-trick");
    const { useQuery } = await import("@powersync/react");

    // Set up a trick with an existing tag
    vi.mocked(useQuery).mockReturnValue({
      data: [
        {
          trick_id: "trick-tags-1",
          tag_id: "tag-existing",
          tag_name: "Existing",
          color: null,
        },
      ],
      isLoading: false,
      isFetching: false,
      error: undefined,
    });
    vi.mocked(useTricks).mockReturnValue({
      tricks: [makeTrick("trick-tags-1", "Tagged Trick")],
      error: null,
      isLoading: false,
    });
    vi.mocked(useTrick).mockReturnValue({
      trick: makeTrick("trick-tags-1", "Tagged Trick"),
      isLoading: false,
    });

    render(<RepertoireView />);

    // Open edit mode — preloads tag-existing into selectedTagIds
    await userEvent.click(screen.getByTestId("edit-trick-tags-1"));
    expect(capturedFormSheetProps.open).toBe(true);

    // Toggle tag-existing (remove it) — exercises the filter branch (243-244)
    // and marks tags as dirty via selectedTagIds.some(...) (line 156)
    act(() => {
      capturedFormSheetProps.onToggleTag?.("tag-existing" as TagId);
    });

    // Toggle a new tag (add it) — exercises the spread branch
    act(() => {
      capturedFormSheetProps.onToggleTag?.("tag-new" as TagId);
    });

    // At this point tagsDirty should be true and selectedTagIds differs from original
    // Submit to exercise the removeTagIds.filter callback (line 195)
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

    await capturedFormSheetProps.onSubmit?.({
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
    });

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
    });
    mockUpdateTrick.mockRejectedValueOnce(new Error("update failed"));

    render(<RepertoireView />);

    await userEvent.click(screen.getByTestId("edit-trick-fail-upd"));

    await capturedFormSheetProps.onSubmit?.({
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
    });

    const { toast } = await import("sonner");
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("repertoire.saveFailed");
    });
  });
});
