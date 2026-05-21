import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ItemId } from "@/db/types";
import type { ItemWithRelations } from "../types";
import { ItemList } from "./item-list";

// Mock ItemCard to avoid rendering its full complexity. The tagsError and
// tricksError flags are reflected as data-attributes so a single render can
// assert each prop was forwarded to every card without exposing the real
// CircleAlert markup. Mirrors the trick-list.test.tsx pattern (issue #267).
vi.mock("./item-card", () => ({
  ItemCard: ({
    item,
    onEdit,
    onDelete,
    tagsError,
    tricksError,
  }: {
    item: ItemWithRelations;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
    tagsError?: boolean;
    tricksError?: boolean;
  }) => (
    <div
      data-tags-error={String(Boolean(tagsError))}
      data-testid={`item-card-${item.id}`}
      data-tricks-error={String(Boolean(tricksError))}
    >
      <span>{item.name}</span>
      <button onClick={() => onEdit(item.id)} type="button">
        Edit
      </button>
      <button onClick={() => onDelete(item.id)} type="button">
        Delete
      </button>
    </div>
  ),
}));

const ITEM_CARD_PATTERN = /item-card/;

const makeItem = (id: string, name: string): ItemWithRelations => ({
  id: id as ItemId,
  name,
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
});

describe("ItemList", () => {
  it("renders a list with the correct aria-label", () => {
    render(<ItemList items={[]} onDelete={vi.fn()} onEdit={vi.fn()} />);
    expect(
      screen.getByRole("list", { name: "collect.title" })
    ).toBeInTheDocument();
  });

  it("renders a card for each item", () => {
    const items = [
      makeItem("i1", "Invisible Deck"),
      makeItem("i2", "Svengali Deck"),
    ];
    render(<ItemList items={items} onDelete={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.getByTestId("item-card-i1")).toBeInTheDocument();
    expect(screen.getByTestId("item-card-i2")).toBeInTheDocument();
  });

  it("renders no cards when the items array is empty", () => {
    render(<ItemList items={[]} onDelete={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.queryAllByTestId(ITEM_CARD_PATTERN)).toHaveLength(0);
  });

  // Issue #267 — tagsError / tricksError must reach every rendered card so
  // each one can swap the affected relation for the muted indicator.
  it("forwards tagsError to every rendered ItemCard", () => {
    const items = [makeItem("i1", "A"), makeItem("i2", "B")];
    render(
      <ItemList items={items} onDelete={vi.fn()} onEdit={vi.fn()} tagsError />
    );

    for (const item of items) {
      expect(screen.getByTestId(`item-card-${item.id}`)).toHaveAttribute(
        "data-tags-error",
        "true"
      );
    }
  });

  it("forwards tricksError to every rendered ItemCard", () => {
    const items = [makeItem("i1", "A"), makeItem("i2", "B")];
    render(
      <ItemList items={items} onDelete={vi.fn()} onEdit={vi.fn()} tricksError />
    );

    for (const item of items) {
      expect(screen.getByTestId(`item-card-${item.id}`)).toHaveAttribute(
        "data-tricks-error",
        "true"
      );
    }
  });

  it("forwards both error flags as false when omitted", () => {
    const items = [makeItem("i1", "A"), makeItem("i2", "B")];
    render(<ItemList items={items} onDelete={vi.fn()} onEdit={vi.fn()} />);

    for (const item of items) {
      const card = screen.getByTestId(`item-card-${item.id}`);
      expect(card).toHaveAttribute("data-tags-error", "false");
      expect(card).toHaveAttribute("data-tricks-error", "false");
    }
  });
});
