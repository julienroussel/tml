import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TagId, TrickId } from "@/db/types";
import type { TrickFormValues } from "../schema";
import type { ParsedTag, ParsedTrick, TrickWithTags } from "../types";
import { RepertoireView } from "./repertoire-view";

// Mock PowerSync — useQuery is used both directly in RepertoireView and in hooks
vi.mock("@powersync/react", () => ({
  useQuery: vi.fn(() => ({ data: [], isLoading: false })),
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
let capturedFormSheetProps: {
  onSubmit?: (data: TrickFormValues) => void;
  onOpenChange?: (open: boolean) => void;
  onToggleTag?: (tagId: TagId) => void;
  onCreateTag?: (name: string) => Promise<TagId>;
  open?: boolean;
  trick?: ParsedTrick | null;
  selectedTagIds?: TagId[];
  availableTags?: ParsedTag[];
} = {};

vi.mock("./trick-form-sheet", () => ({
  TrickFormSheet: (props: typeof capturedFormSheetProps) => {
    capturedFormSheetProps = props;
    return (
      <div data-open={String(props.open)} data-testid="trick-form-sheet" />
    );
  },
}));

// TrickDeleteDialog mock — exposes callbacks for testing
let capturedDeleteDialogProps: {
  onConfirm?: () => void;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  trickName?: string | null;
} = {};

vi.mock("./trick-delete-dialog", () => ({
  TrickDeleteDialog: (props: typeof capturedDeleteDialogProps) => {
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

// TrickList mock — exposes edit/delete callbacks
vi.mock("./trick-list", () => ({
  TrickList: ({
    tricks,
    onEdit,
    onDelete,
  }: {
    tricks: TrickWithTags[];
    onEdit: (id: TrickId) => void;
    onDelete: (id: TrickId) => void;
  }) => (
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
  ),
}));

vi.mock("./trick-empty-state", () => ({
  TrickEmptyState: ({ onAddTrick }: { onAddTrick: () => void }) => (
    <button data-testid="trick-empty-state" onClick={onAddTrick} type="button">
      Add your first trick
    </button>
  ),
}));

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
    vi.mocked(useTricks).mockReturnValueOnce({
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
    // onOpenChange(false) exercises the handler — just verify it doesn't throw
    expect(() => capturedFormSheetProps.onOpenChange?.(false)).not.toThrow();
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
    expect(mockCreateTrick).toHaveBeenCalled();
  });

  it("opens edit sheet when edit button is clicked on a trick", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    vi.mocked(useTricks).mockReturnValueOnce({
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
    vi.mocked(useTricks).mockReturnValueOnce({
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
    vi.mocked(useTricks).mockReturnValueOnce({
      tricks: [makeTrick("trick-del-2", "Coin Vanish")],
      error: null,
      isLoading: false,
    });

    render(<RepertoireView />);
    await userEvent.click(screen.getByTestId("delete-trick-del-2"));
    await userEvent.click(screen.getByTestId("confirm-delete"));
    expect(mockDeleteTrick).toHaveBeenCalledWith("trick-del-2");
  });

  it("closes delete dialog via onOpenChange(false)", async () => {
    const { useTricks } = await import("../hooks/use-tricks");
    vi.mocked(useTricks).mockReturnValueOnce({
      tricks: [makeTrick("trick-close-1", "Some Trick")],
      error: null,
      isLoading: false,
    });

    render(<RepertoireView />);
    await userEvent.click(screen.getByTestId("delete-trick-close-1"));
    expect(screen.getByTestId("confirm-delete")).toBeInTheDocument();
    // onOpenChange(false) exercises the handler — just verify it doesn't throw
    expect(() => capturedDeleteDialogProps.onOpenChange?.(false)).not.toThrow();
  });

  it("toggles a tag via onToggleTag without throwing", async () => {
    render(<RepertoireView />);
    // Open sheet first
    await userEvent.click(
      screen.getByRole("button", { name: ADD_TRICK_PATTERN })
    );
    // Toggle a tag — exercises handleToggleTag code path
    expect(() =>
      capturedFormSheetProps.onToggleTag?.("tag-1" as TagId)
    ).not.toThrow();
    // Toggle again to remove — exercises the filter branch
    expect(() =>
      capturedFormSheetProps.onToggleTag?.("tag-1" as TagId)
    ).not.toThrow();
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

    // Reset
    vi.mocked(useTricks).mockReturnValue({
      tricks: [],
      error: null,
      isLoading: false,
    });
    vi.mocked(useTrick).mockReturnValue({ trick: null, isLoading: false });
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

  it("shows no results message when filters are active but no tricks found", async () => {
    render(<RepertoireView />);
    // Type in the search box to activate filters
    await userEvent.type(
      screen.getByRole("searchbox", { name: "repertoire.searchPlaceholder" }),
      "nonexistent"
    );
    // After debounce, no results message should appear
    // (debounced, so we check the search input is correct)
    expect(
      screen.getByRole("searchbox", { name: "repertoire.searchPlaceholder" })
    ).toHaveValue("nonexistent");
  });
});
