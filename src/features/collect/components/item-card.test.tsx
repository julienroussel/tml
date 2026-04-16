import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ItemId, TagId, TrickId } from "@/db/types";
import type { ParsedTag } from "@/features/repertoire/types";
import type { ItemWithRelations } from "../types";
import {
  getContrastColor,
  HEX_COLOR_RE,
  ItemCard,
  MAX_VISIBLE_TAGS,
} from "./item-card";

// DropdownMenu mock renders all children synchronously since Radix portals
// don't work in jsdom. asChild unwraps so the inner <button> is the trigger.
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({
    children,
    asChild: _asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    variant: _variant,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    variant?: "default" | "destructive";
  }) => (
    <button onClick={onClick} type="button">
      {children}
    </button>
  ),
}));

const EDIT_BUTTON_NAME = /^collect\.edit:/;
const MENU_TRIGGER_NAME = "collect.cardActions";
const EDIT_MENU_ITEM_NAME = "collect.edit";
const DELETE_MENU_ITEM_NAME = "collect.delete";
const QUANTITY_LABEL_RE = /^collect\.quantityLabel/;
const LINKED_TRICKS_RE = /^collect\.linkedTricksCount/;
const CONDITION_RE = /^collect\.condition\./;
const OVERFLOW_BADGE_RE = /^\+\d+$/;
const MENTALISM_RE = /mentalism/;

function makeItem(
  overrides: Partial<ItemWithRelations> = {}
): ItemWithRelations {
  return {
    id: "item-1" as ItemId,
    name: "Invisible Deck",
    type: "deck",
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
    tags: [],
    tricks: [],
    ...overrides,
  };
}

function makeTag(overrides: Partial<ParsedTag> = {}): ParsedTag {
  return {
    id: "tag-1" as TagId,
    name: "Tag",
    color: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("MAX_VISIBLE_TAGS", () => {
  it("is 3", () => {
    expect(MAX_VISIBLE_TAGS).toBe(3);
  });
});

describe("HEX_COLOR_RE", () => {
  it("matches lowercase 6-digit hex with leading #", () => {
    expect(HEX_COLOR_RE.test("#ff00aa")).toBe(true);
  });

  it("matches uppercase hex (case insensitive)", () => {
    expect(HEX_COLOR_RE.test("#FF00AA")).toBe(true);
  });

  it("matches mixed case hex", () => {
    expect(HEX_COLOR_RE.test("#Ff00Aa")).toBe(true);
  });

  it("rejects 3-digit shorthand", () => {
    expect(HEX_COLOR_RE.test("#fff")).toBe(false);
  });

  it("rejects hex without leading #", () => {
    expect(HEX_COLOR_RE.test("ff00aa")).toBe(false);
  });

  it("rejects 8-digit hex with alpha channel", () => {
    expect(HEX_COLOR_RE.test("#ff00aaff")).toBe(false);
  });

  it("rejects non-hex characters", () => {
    expect(HEX_COLOR_RE.test("#zzzzzz")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(HEX_COLOR_RE.test("")).toBe(false);
  });
});

describe("getContrastColor", () => {
  it("returns near-white text on pure black background", () => {
    expect(getContrastColor("#000000")).toBe("#ffffff");
  });

  it("returns near-black text on pure white background", () => {
    expect(getContrastColor("#ffffff")).toBe("#000000");
  });

  it("returns black on yellow (high luminance)", () => {
    expect(getContrastColor("#ffff00")).toBe("#000000");
  });

  it("returns white on dark blue (low luminance)", () => {
    expect(getContrastColor("#000080")).toBe("#ffffff");
  });

  // #777777 sits near the WCAG luminance pivot — given the algorithm's
  // tie-break (`contrastWithBlack >= contrastWithWhite`), mid-grey resolves
  // to black text. Asserting one side guards against accidental flips.
  it("returns black on mid-grey near the luminance pivot", () => {
    expect(getContrastColor("#777777")).toBe("#000000");
  });

  it("handles uppercase hex input", () => {
    expect(getContrastColor("#FFFFFF")).toBe("#000000");
  });
});

describe("ItemCard rendering — basic", () => {
  it("renders the item name", () => {
    render(<ItemCard item={makeItem()} onDelete={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.getByText("Invisible Deck")).toBeInTheDocument();
  });

  it("renders description when present", () => {
    render(
      <ItemCard
        item={makeItem({ description: "A classic mentalism prop" })}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />
    );
    expect(screen.getByText("A classic mentalism prop")).toBeInTheDocument();
  });

  it("does not render description when null", () => {
    render(<ItemCard item={makeItem()} onDelete={vi.fn()} onEdit={vi.fn()} />);
    // No description paragraph should exist
    expect(screen.queryByText(MENTALISM_RE)).not.toBeInTheDocument();
  });

  it("renders the menu trigger button", () => {
    render(<ItemCard item={makeItem()} onDelete={vi.fn()} onEdit={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: MENU_TRIGGER_NAME })
    ).toBeInTheDocument();
  });

  it("renders the inner edit button labelled with the item name", () => {
    render(<ItemCard item={makeItem()} onDelete={vi.fn()} onEdit={vi.fn()} />);
    const editButton = screen.getByRole("button", { name: EDIT_BUTTON_NAME });
    expect(editButton).toHaveAttribute(
      "aria-label",
      "collect.edit: Invisible Deck"
    );
  });

  // Phrasing-content rules forbid a real <h3> inside a <button>, but we still
  // need the item name to be exposed as a heading for screen-reader H-key
  // navigation. role="heading" + aria-level preserves the outline while
  // keeping the markup HTML-valid.
  it("exposes the item name as a level-3 heading for assistive tech", () => {
    render(<ItemCard item={makeItem()} onDelete={vi.fn()} onEdit={vi.fn()} />);
    const heading = screen.getByRole("heading", {
      name: "Invisible Deck",
      level: 3,
    });
    expect(heading).toBeInTheDocument();
  });
});

describe("ItemCard interactions", () => {
  it("calls onEdit when the inner edit button is clicked", async () => {
    const onEdit = vi.fn();
    render(<ItemCard item={makeItem()} onDelete={vi.fn()} onEdit={onEdit} />);

    await userEvent.click(
      screen.getByRole("button", { name: EDIT_BUTTON_NAME })
    );

    expect(onEdit).toHaveBeenCalledWith("item-1");
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("calls onEdit when Enter is pressed on the edit button", async () => {
    const onEdit = vi.fn();
    render(<ItemCard item={makeItem()} onDelete={vi.fn()} onEdit={onEdit} />);

    const editButton = screen.getByRole("button", { name: EDIT_BUTTON_NAME });
    editButton.focus();
    await userEvent.keyboard("{Enter}");

    expect(onEdit).toHaveBeenCalledWith("item-1");
  });

  it("calls onEdit when Space is pressed on the edit button", async () => {
    const onEdit = vi.fn();
    render(<ItemCard item={makeItem()} onDelete={vi.fn()} onEdit={onEdit} />);

    const editButton = screen.getByRole("button", { name: EDIT_BUTTON_NAME });
    editButton.focus();
    await userEvent.keyboard(" ");

    // Native button activation on Space — should trigger onEdit. Browsers
    // also call preventDefault internally so the page does not scroll.
    expect(onEdit).toHaveBeenCalledWith("item-1");
  });

  it("does not call onEdit when the menu trigger is clicked", async () => {
    const onEdit = vi.fn();
    render(<ItemCard item={makeItem()} onDelete={vi.fn()} onEdit={onEdit} />);

    await userEvent.click(
      screen.getByRole("button", { name: MENU_TRIGGER_NAME })
    );

    // Edit and trigger are siblings — clicking the trigger never bubbles
    // through the edit button, so onEdit must not be called.
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("calls onEdit when the dropdown Edit item is clicked", async () => {
    const onEdit = vi.fn();
    render(<ItemCard item={makeItem()} onDelete={vi.fn()} onEdit={onEdit} />);

    await userEvent.click(
      screen.getByRole("button", { name: EDIT_MENU_ITEM_NAME })
    );

    expect(onEdit).toHaveBeenCalledWith("item-1");
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("calls onDelete when the dropdown Delete item is clicked", async () => {
    const onDelete = vi.fn();
    render(<ItemCard item={makeItem()} onDelete={onDelete} onEdit={vi.fn()} />);

    await userEvent.click(
      screen.getByRole("button", { name: DELETE_MENU_ITEM_NAME })
    );

    expect(onDelete).toHaveBeenCalledWith("item-1");
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

describe("ItemCard tag overflow", () => {
  it("renders no tag list when there are 0 tags", () => {
    render(
      <ItemCard
        item={makeItem({ tags: [] })}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />
    );
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("renders all tags and no overflow badge when count equals MAX_VISIBLE_TAGS", () => {
    const tags = [
      makeTag({ id: "t1" as TagId, name: "Tag1" }),
      makeTag({ id: "t2" as TagId, name: "Tag2" }),
      makeTag({ id: "t3" as TagId, name: "Tag3" }),
    ];
    render(
      <ItemCard item={makeItem({ tags })} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    expect(screen.getByText("Tag1")).toBeInTheDocument();
    expect(screen.getByText("Tag2")).toBeInTheDocument();
    expect(screen.getByText("Tag3")).toBeInTheDocument();
    expect(screen.queryByText(OVERFLOW_BADGE_RE)).not.toBeInTheDocument();
  });

  it("renders MAX_VISIBLE_TAGS badges plus +1 when 4 tags are provided", () => {
    const tags = Array.from({ length: 4 }, (_, i) =>
      makeTag({ id: `t${i + 1}` as TagId, name: `Tag${i + 1}` })
    );
    render(
      <ItemCard item={makeItem({ tags })} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    expect(screen.getByText("Tag1")).toBeInTheDocument();
    expect(screen.getByText("Tag2")).toBeInTheDocument();
    expect(screen.getByText("Tag3")).toBeInTheDocument();
    expect(screen.queryByText("Tag4")).not.toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
  });

  it("renders MAX_VISIBLE_TAGS badges plus +7 when 10 tags are provided", () => {
    const tags = Array.from({ length: 10 }, (_, i) =>
      makeTag({ id: `t${i + 1}` as TagId, name: `Tag${i + 1}` })
    );
    render(
      <ItemCard item={makeItem({ tags })} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    expect(screen.getByText("Tag1")).toBeInTheDocument();
    expect(screen.getByText("Tag3")).toBeInTheDocument();
    expect(screen.queryByText("Tag4")).not.toBeInTheDocument();
    expect(screen.getByText("+7")).toBeInTheDocument();
  });
});

describe("ItemCard tag color rendering", () => {
  it("applies inline background style when tag color is a valid 6-digit hex", () => {
    const tags = [
      makeTag({ id: "t-red" as TagId, name: "Red", color: "#ff0000" }),
    ];
    render(
      <ItemCard item={makeItem({ tags })} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    const badge = screen.getByText("Red");
    expect(badge).toHaveStyle({ backgroundColor: "rgb(255, 0, 0)" });
    // Pure red has luminance ~0.21 which makes black slightly more
    // contrasting than white per the WCAG ratio — assert against the
    // current algorithm's output rather than perceived "best".
    expect(badge).toHaveStyle({ color: "rgb(0, 0, 0)" });
  });

  it("accepts uppercase hex (case-insensitive regex)", () => {
    const tags = [
      makeTag({ id: "t-up" as TagId, name: "Upper", color: "#FF0000" }),
    ];
    render(
      <ItemCard item={makeItem({ tags })} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    const badge = screen.getByText("Upper");
    expect(badge).toHaveStyle({ backgroundColor: "rgb(255, 0, 0)" });
  });

  it("falls back to plain badge when hex is missing # prefix", () => {
    const tags = [
      makeTag({ id: "t-bad" as TagId, name: "Bad", color: "ff0000" }),
    ];
    render(
      <ItemCard item={makeItem({ tags })} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    const badge = screen.getByText("Bad");
    expect(badge).not.toHaveStyle({ backgroundColor: "rgb(255, 0, 0)" });
  });

  it("falls back to plain badge for 3-digit shorthand", () => {
    const tags = [
      makeTag({ id: "t-3" as TagId, name: "Short", color: "#fff" }),
    ];
    render(
      <ItemCard item={makeItem({ tags })} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    const badge = screen.getByText("Short");
    expect(badge).not.toHaveStyle({ backgroundColor: "rgb(255, 255, 255)" });
  });

  it("falls back to plain badge for 8-digit hex with alpha", () => {
    const tags = [
      makeTag({ id: "t-a" as TagId, name: "Alpha", color: "#ff0000ff" }),
    ];
    render(
      <ItemCard item={makeItem({ tags })} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    const badge = screen.getByText("Alpha");
    expect(badge).not.toHaveStyle({ backgroundColor: "rgb(255, 0, 0)" });
  });
});

describe("ItemCard brand/price/quantity row", () => {
  it("does not render the row when all three are absent and quantity is 1", () => {
    render(
      <ItemCard
        item={makeItem({ brand: null, purchasePrice: null, quantity: 1 })}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />
    );
    // None of the constituent text appears.
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
    expect(screen.queryByText(QUANTITY_LABEL_RE)).not.toBeInTheDocument();
  });

  it("renders only the brand when only brand is present", () => {
    render(
      <ItemCard
        item={makeItem({ brand: "Bicycle" })}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />
    );
    expect(screen.getByText("Bicycle")).toBeInTheDocument();
  });

  it("renders price formatted to 2 decimal places when only price is present", () => {
    render(
      <ItemCard
        item={makeItem({ purchasePrice: 29.9 })}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />
    );
    expect(screen.getByText("$29.90")).toBeInTheDocument();
  });

  it("renders price of 0 (truthy condition uses !== null)", () => {
    render(
      <ItemCard
        item={makeItem({ purchasePrice: 0 })}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />
    );
    expect(screen.getByText("$0.00")).toBeInTheDocument();
  });

  it("renders quantity label only when quantity > 1", () => {
    render(
      <ItemCard
        item={makeItem({ quantity: 5 })}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />
    );
    expect(
      screen.getByText("collect.quantityLabel (count: 5)")
    ).toBeInTheDocument();
  });

  it("does not render quantity label when quantity is exactly 1", () => {
    render(
      <ItemCard
        item={makeItem({ quantity: 1, brand: "Bicycle" })}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />
    );
    // Brand renders, but quantity does not.
    expect(screen.getByText("Bicycle")).toBeInTheDocument();
    expect(
      screen.queryByText("collect.quantityLabel (count: 1)")
    ).not.toBeInTheDocument();
  });

  it("renders all three fields together when all are set", () => {
    render(
      <ItemCard
        item={makeItem({ brand: "Bicycle", purchasePrice: 12.5, quantity: 3 })}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />
    );
    expect(screen.getByText("Bicycle")).toBeInTheDocument();
    expect(screen.getByText("$12.50")).toBeInTheDocument();
    expect(
      screen.getByText("collect.quantityLabel (count: 3)")
    ).toBeInTheDocument();
  });
});

describe("ItemCard linked tricks", () => {
  it("does not render the linked-tricks row when no tricks are linked", () => {
    render(
      <ItemCard
        item={makeItem({ tricks: [] })}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />
    );
    expect(screen.queryByText(LINKED_TRICKS_RE)).not.toBeInTheDocument();
  });

  it("renders the linked-tricks count when tricks are linked", () => {
    render(
      <ItemCard
        item={makeItem({
          tricks: [
            { id: "trick-1" as TrickId, name: "T1" },
            { id: "trick-2" as TrickId, name: "T2" },
          ],
        })}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />
    );
    expect(
      screen.getByText("collect.linkedTricksCount (count: 2)")
    ).toBeInTheDocument();
  });
});

describe("ItemCard condition", () => {
  it("renders the condition badge when condition is set", () => {
    render(
      <ItemCard
        item={makeItem({ condition: "good" })}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />
    );
    expect(screen.getByText("collect.condition.good")).toBeInTheDocument();
  });

  it("does not render the condition badge when condition is null", () => {
    render(
      <ItemCard
        item={makeItem({ condition: null })}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />
    );
    expect(screen.queryByText(CONDITION_RE)).not.toBeInTheDocument();
  });
});
