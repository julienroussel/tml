import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { TagId } from "@/db/types";
import type { ParsedTag } from "../types";
import { TagPicker } from "./tag-picker";

const CREATE_TAG_PATTERN = /repertoire\.tagPicker\.create/;

// cmdk uses ResizeObserver and scrollIntoView internally
beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class ResizeObserver {
      observe(): void {
        // noop
      }
      unobserve(): void {
        // noop
      }
      disconnect(): void {
        // noop
      }
    };
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined;
  }
});

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

const makeTag = (id: string, name: string, color?: string): ParsedTag => ({
  id: id as TagId,
  name,
  color: color ?? null,
});

describe("TagPicker", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(
      <TagPicker
        availableTags={[]}
        onCreateTag={vi.fn()}
        onToggleTag={vi.fn()}
        selectedTagIds={[]}
      />
    );
    expect(
      screen.getByRole("button", { name: "repertoire.tagPicker.search" })
    ).toBeInTheDocument();
  });

  it("shows selected tag count badge when tags are selected", () => {
    const tags = [makeTag("t1", "Cards"), makeTag("t2", "Coins")];
    render(
      <TagPicker
        availableTags={tags}
        onCreateTag={vi.fn()}
        onToggleTag={vi.fn()}
        selectedTagIds={["t1" as TagId]}
      />
    );
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("does not show count badge when no tags are selected", () => {
    const tags = [makeTag("t1", "Cards")];
    render(
      <TagPicker
        availableTags={tags}
        onCreateTag={vi.fn()}
        onToggleTag={vi.fn()}
        selectedTagIds={[]}
      />
    );
    // Badge is only rendered when selectedTagIds.length > 0
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("renders selected tag badges with remove buttons", () => {
    const tags = [makeTag("t1", "Cards"), makeTag("t2", "Coins")];
    render(
      <TagPicker
        availableTags={tags}
        onCreateTag={vi.fn()}
        onToggleTag={vi.fn()}
        selectedTagIds={["t1" as TagId]}
      />
    );
    expect(screen.getByText("Cards")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "repertoire.tagPicker.remove (name: Cards)",
      })
    ).toBeInTheDocument();
  });

  it("calls onToggleTag when remove button on a selected tag is clicked", async () => {
    const onToggleTag = vi.fn();
    const tags = [makeTag("t1", "Cards")];
    render(
      <TagPicker
        availableTags={tags}
        onCreateTag={vi.fn()}
        onToggleTag={onToggleTag}
        selectedTagIds={["t1" as TagId]}
      />
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "repertoire.tagPicker.remove (name: Cards)",
      })
    );
    expect(onToggleTag).toHaveBeenCalledWith("t1");
  });

  it("renders colored dot for tags with valid hex color", () => {
    const tags = [makeTag("t1", "Red Tag", "#ff0000")];
    render(
      <TagPicker
        availableTags={tags}
        onCreateTag={vi.fn()}
        onToggleTag={vi.fn()}
        selectedTagIds={["t1" as TagId]}
      />
    );
    // Color dot is aria-hidden span with inline style
    const dots = document.querySelectorAll(
      '[style*="background-color: rgb(255, 0, 0)"]'
    );
    expect(dots.length).toBeGreaterThan(0);
  });

  it("opens the picker and shows all available tags", async () => {
    const tags = [makeTag("t1", "Beginner"), makeTag("t2", "Intermediate")];
    render(
      <TagPicker
        availableTags={tags}
        onCreateTag={vi.fn()}
        onToggleTag={vi.fn()}
        selectedTagIds={[]}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "repertoire.tagPicker.search" })
    );
    // Tags should now be visible in the command list
    expect(screen.getByText("Beginner")).toBeInTheDocument();
    expect(screen.getByText("Intermediate")).toBeInTheDocument();
  });

  it("shows create option when searching for a non-existent tag", async () => {
    const tags = [makeTag("t1", "Beginner")];
    render(
      <TagPicker
        availableTags={tags}
        onCreateTag={vi.fn()}
        onToggleTag={vi.fn()}
        selectedTagIds={[]}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "repertoire.tagPicker.search" })
    );
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "NewTag");
    // Create option should appear
    expect(
      screen.getByText("repertoire.tagPicker.create (name: NewTag)")
    ).toBeInTheDocument();
  });

  it("calls onCreateTag and onToggleTag when create option is selected", async () => {
    const newTagId = "new-tag-id" as TagId;
    const onCreateTag = vi.fn().mockResolvedValue(newTagId);
    const onToggleTag = vi.fn();
    render(
      <TagPicker
        availableTags={[]}
        onCreateTag={onCreateTag}
        onToggleTag={onToggleTag}
        selectedTagIds={[]}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "repertoire.tagPicker.search" })
    );
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "MyNewTag");
    // Click the create option
    await userEvent.click(
      screen.getByText("repertoire.tagPicker.create (name: MyNewTag)")
    );
    expect(onCreateTag).toHaveBeenCalledWith("MyNewTag");
    // Wait for the async create to complete
    await waitFor(() => {
      expect(onToggleTag).toHaveBeenCalledWith(newTagId);
    });
  });

  it("does not show tag badge list when no tags are selected", () => {
    const tags = [makeTag("t1", "Cards")];
    render(
      <TagPicker
        availableTags={tags}
        onCreateTag={vi.fn()}
        onToggleTag={vi.fn()}
        selectedTagIds={[]}
      />
    );
    // No selected tags list when empty
    expect(
      screen.queryByRole("list", { name: "repertoire.tagPicker.selectedTags" })
    ).not.toBeInTheDocument();
  });

  it("renders selected tags list when tags are selected", () => {
    const tags = [makeTag("t1", "Cards")];
    render(
      <TagPicker
        availableTags={tags}
        onCreateTag={vi.fn()}
        onToggleTag={vi.fn()}
        selectedTagIds={["t1" as TagId]}
      />
    );
    expect(
      screen.getByRole("list", { name: "repertoire.tagPicker.selectedTags" })
    ).toBeInTheDocument();
  });

  it("does not allow selecting more tags when maxTags limit is reached", async () => {
    const onToggleTag = vi.fn();
    const tags = [makeTag("t1", "Cards"), makeTag("t2", "Coins")];
    render(
      <TagPicker
        availableTags={tags}
        maxTags={1}
        onCreateTag={vi.fn()}
        onToggleTag={onToggleTag}
        selectedTagIds={["t1" as TagId]}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "repertoire.tagPicker.search" })
    );
    // "Coins" is unselected but atLimit is true — the CommandItem is disabled
    // Clicking a disabled cmdk item does not fire onSelect
    const coinsItem = screen.getByText("Coins");
    await userEvent.click(coinsItem);
    expect(onToggleTag).not.toHaveBeenCalled();
  });

  it("shows error toast when tag creation fails", async () => {
    const { toast } = await import("sonner");
    const onCreateTag = vi.fn().mockRejectedValue(new Error("fail"));
    render(
      <TagPicker
        availableTags={[]}
        onCreateTag={onCreateTag}
        onToggleTag={vi.fn()}
        selectedTagIds={[]}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "repertoire.tagPicker.search" })
    );
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "FailTag");
    await userEvent.click(
      screen.getByText("repertoire.tagPicker.create (name: FailTag)")
    );
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "repertoire.tagPicker.createFailed"
      );
    });
  });

  it("hides create option when search exactly matches existing tag name", async () => {
    const tags = [makeTag("t1", "Beginner")];
    render(
      <TagPicker
        availableTags={tags}
        onCreateTag={vi.fn()}
        onToggleTag={vi.fn()}
        selectedTagIds={[]}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "repertoire.tagPicker.search" })
    );
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "Beginner");
    expect(screen.queryByText(CREATE_TAG_PATTERN)).not.toBeInTheDocument();
  });

  it("calls onToggleTag when clicking an unselected tag in the picker", async () => {
    const onToggleTag = vi.fn();
    const tags = [makeTag("t1", "Cards")];
    render(
      <TagPicker
        availableTags={tags}
        onCreateTag={vi.fn()}
        onToggleTag={onToggleTag}
        selectedTagIds={[]}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "repertoire.tagPicker.search" })
    );
    await userEvent.click(screen.getByText("Cards"));
    expect(onToggleTag).toHaveBeenCalledWith("t1");
  });

  it("allows deselecting a tag when maxTags limit is reached", async () => {
    const onToggleTag = vi.fn();
    const tags = [makeTag("t1", "Cards"), makeTag("t2", "Coins")];
    render(
      <TagPicker
        availableTags={tags}
        maxTags={1}
        onCreateTag={vi.fn()}
        onToggleTag={onToggleTag}
        selectedTagIds={["t1" as TagId]}
      />
    );
    // Remove "Cards" via the badge remove button — this deselects an already-selected tag
    await userEvent.click(
      screen.getByRole("button", {
        name: "repertoire.tagPicker.remove (name: Cards)",
      })
    );
    expect(onToggleTag).toHaveBeenCalledWith("t1");
  });
});
