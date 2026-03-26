import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { TagId } from "@/db/types";
import type { ParsedTag } from "../types";
import { TagPicker } from "./tag-picker";

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
    await vi.waitFor(() => {
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
});
