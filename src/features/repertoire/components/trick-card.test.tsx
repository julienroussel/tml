import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TagId, TrickId } from "@/db/types";
import type { TrickWithTags } from "../types";
import { formatDuration, getContrastColor, TrickCard } from "./trick-card";

const CARD_WARP_PATTERN = /Card Warp/;
const DURATION_PATTERN = /\d+[ms]/;

const makeTrick = (overrides: Partial<TrickWithTags> = {}): TrickWithTags => ({
  id: "trick-1" as TrickId,
  name: "Card Warp",
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
  tags: [],
  ...overrides,
});

describe("TrickCard", () => {
  it("renders the trick name", () => {
    render(
      <TrickCard onDelete={vi.fn()} onEdit={vi.fn()} trick={makeTrick()} />
    );
    expect(screen.getByText("Card Warp")).toBeInTheDocument();
  });

  it("renders description when present", () => {
    render(
      <TrickCard
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        trick={makeTrick({ description: "A great trick" })}
      />
    );
    expect(screen.getByText("A great trick")).toBeInTheDocument();
  });

  it("calls onEdit when card is clicked", async () => {
    const onEdit = vi.fn();
    render(
      <TrickCard onDelete={vi.fn()} onEdit={onEdit} trick={makeTrick()} />
    );
    await userEvent.click(
      screen.getByRole("button", { name: CARD_WARP_PATTERN })
    );
    expect(onEdit).toHaveBeenCalledWith("trick-1");
  });

  it("calls onEdit when Enter is pressed on the card", async () => {
    const onEdit = vi.fn();
    render(
      <TrickCard onDelete={vi.fn()} onEdit={onEdit} trick={makeTrick()} />
    );
    const card = screen.getByRole("button", { name: CARD_WARP_PATTERN });
    card.focus();
    await userEvent.keyboard("{Enter}");
    expect(onEdit).toHaveBeenCalledWith("trick-1");
  });

  it("renders category badge when category is set", () => {
    render(
      <TrickCard
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        trick={makeTrick({ category: "Cards" })}
      />
    );
    expect(screen.getByText("Cards")).toBeInTheDocument();
  });

  it("renders duration when set", () => {
    render(
      <TrickCard
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        trick={makeTrick({ duration: 90 })}
      />
    );
    expect(screen.getByText("1m 30s")).toBeInTheDocument();
  });

  it("renders tag badges for up to 3 tags", () => {
    const tags = [
      { id: "t1" as TagId, name: "Tag1", color: null },
      { id: "t2" as TagId, name: "Tag2", color: null },
      { id: "t3" as TagId, name: "Tag3", color: null },
    ];
    render(
      <TrickCard
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        trick={makeTrick({ tags })}
      />
    );
    expect(screen.getByText("Tag1")).toBeInTheDocument();
    expect(screen.getByText("Tag2")).toBeInTheDocument();
    expect(screen.getByText("Tag3")).toBeInTheDocument();
  });

  it("shows overflow count when there are more than 3 tags", () => {
    const tags = Array.from({ length: 5 }, (_, i) => ({
      id: `t${i + 1}` as TagId,
      name: `Tag${i + 1}`,
      color: null,
    }));
    render(
      <TrickCard
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        trick={makeTrick({ tags })}
      />
    );
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("renders colored tag badge for tags with valid hex color", () => {
    const tags = [{ id: "t1" as TagId, name: "Red", color: "#ff0000" }];
    render(
      <TrickCard
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        trick={makeTrick({ tags })}
      />
    );
    expect(screen.getByText("Red")).toBeInTheDocument();
  });

  it("renders without description when null", () => {
    render(
      <TrickCard
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        trick={makeTrick({ description: null })}
      />
    );
    expect(screen.getByText("Card Warp")).toBeInTheDocument();
  });

  it("does not render duration when null", () => {
    render(
      <TrickCard
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        trick={makeTrick({ duration: null })}
      />
    );
    // No time display
    expect(screen.queryByText(DURATION_PATTERN)).not.toBeInTheDocument();
  });

  it("renders effect type badge when effectType is set", () => {
    render(
      <TrickCard
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        trick={makeTrick({ effectType: "Vanish" })}
      />
    );
    expect(screen.getByText("Vanish")).toBeInTheDocument();
  });

  it("renders difficulty stars when difficulty is set", () => {
    render(
      <TrickCard
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        trick={makeTrick({ difficulty: 3 })}
      />
    );
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("calls onEdit when Space is pressed on the card", async () => {
    const onEdit = vi.fn();
    render(
      <TrickCard onDelete={vi.fn()} onEdit={onEdit} trick={makeTrick()} />
    );
    const card = screen.getByRole("button", { name: CARD_WARP_PATTERN });
    card.focus();
    await userEvent.keyboard(" ");
    expect(onEdit).toHaveBeenCalledWith("trick-1");
  });

  it("renders the actions menu trigger", () => {
    render(
      <TrickCard onDelete={vi.fn()} onEdit={vi.fn()} trick={makeTrick()} />
    );
    expect(
      screen.getByRole("button", { name: "repertoire.cardActions" })
    ).toBeInTheDocument();
  });

  it("clicking the menu trigger does not trigger card's onEdit", async () => {
    const onEdit = vi.fn();
    render(
      <TrickCard onDelete={vi.fn()} onEdit={onEdit} trick={makeTrick()} />
    );
    const menuTrigger = screen.getByRole("button", {
      name: "repertoire.cardActions",
    });
    // Click the trigger — stopPropagation prevents card's onClick from firing
    await userEvent.click(menuTrigger);
    // onEdit should NOT have been called from the card's onClick handler
    // (it could be called from the dropdown item, but we haven't clicked that)
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("handles keydown on the menu trigger without propagating to card", async () => {
    const onEdit = vi.fn();
    render(
      <TrickCard onDelete={vi.fn()} onEdit={onEdit} trick={makeTrick()} />
    );
    const menuTrigger = screen.getByRole("button", {
      name: "repertoire.cardActions",
    });
    menuTrigger.focus();
    // KeyDown on the trigger calls handleMenuTriggerKeyDown (stopPropagation)
    await userEvent.keyboard("{ArrowDown}");
    // The card's handleCardKeyDown should not have fired Enter or Space
    expect(onEdit).not.toHaveBeenCalled();
  });
});

describe("formatDuration", () => {
  it("formats seconds only", () => {
    expect(formatDuration(30)).toBe("30s");
  });

  it("formats minutes only", () => {
    expect(formatDuration(60)).toBe("1m");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(90)).toBe("1m 30s");
  });

  it("formats zero seconds", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  it("formats large values", () => {
    expect(formatDuration(3661)).toBe("61m 1s");
  });
});

describe("getContrastColor", () => {
  it("returns black for light background", () => {
    expect(getContrastColor("#ffffff")).toBe("#000000");
  });

  it("returns white for dark background", () => {
    expect(getContrastColor("#000000")).toBe("#ffffff");
  });

  it("returns black for yellow", () => {
    expect(getContrastColor("#ffff00")).toBe("#000000");
  });

  it("returns white for dark blue", () => {
    expect(getContrastColor("#000080")).toBe("#ffffff");
  });
});
