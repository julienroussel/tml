import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TrickId } from "@/db/types";
import type { TrickWithTags } from "../types";
import { TrickList } from "./trick-list";

// Mock TrickCard to avoid rendering its full complexity
vi.mock("./trick-card", () => ({
  TrickCard: ({
    trick,
    onEdit,
    onDelete,
  }: {
    trick: TrickWithTags;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
  }) => (
    <div data-testid={`trick-card-${trick.id}`}>
      <span>{trick.name}</span>
      <button onClick={() => onEdit(trick.id)} type="button">
        Edit
      </button>
      <button onClick={() => onDelete(trick.id)} type="button">
        Delete
      </button>
    </div>
  ),
}));

const TRICK_CARD_PATTERN = /trick-card/;

const makeTrick = (id: string, name: string): TrickWithTags => ({
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
  tags: [],
});

describe("TrickList", () => {
  it("renders a list with the correct aria-label", () => {
    render(<TrickList onDelete={vi.fn()} onEdit={vi.fn()} tricks={[]} />);
    expect(
      screen.getByRole("list", { name: "repertoire.title" })
    ).toBeInTheDocument();
  });

  it("renders a card for each trick", () => {
    const tricks = [makeTrick("t1", "Card Warp"), makeTrick("t2", "Coins")];
    render(<TrickList onDelete={vi.fn()} onEdit={vi.fn()} tricks={tricks} />);
    expect(screen.getByTestId("trick-card-t1")).toBeInTheDocument();
    expect(screen.getByTestId("trick-card-t2")).toBeInTheDocument();
  });

  it("renders no cards when tricks array is empty", () => {
    render(<TrickList onDelete={vi.fn()} onEdit={vi.fn()} tricks={[]} />);
    expect(screen.queryAllByTestId(TRICK_CARD_PATTERN)).toHaveLength(0);
  });
});
