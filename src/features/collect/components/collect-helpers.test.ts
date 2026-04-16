import { describe, expect, it } from "vitest";
import type { ItemId, TagId, TrickId } from "@/db/types";
import {
  buildItemTagMap,
  buildItemTrickMap,
  type ItemTagRow,
  type ItemTrickRow,
} from "./collect-helpers";

describe("buildItemTagMap", () => {
  it("returns empty map for empty array", () => {
    const result = buildItemTagMap([]);
    expect(result.size).toBe(0);
  });

  it("maps single item with one tag", () => {
    const rows: ItemTagRow[] = [
      {
        item_id: "00000000-0000-4000-8000-00000000aa01",
        tag_id: "00000000-0000-4000-8000-00000000bb01",
        tag_name: "Fire",
        color: "#ff0000",
      },
    ];
    const result = buildItemTagMap(rows);

    expect(result.size).toBe(1);
    expect(
      result.get("00000000-0000-4000-8000-00000000aa01" as ItemId)
    ).toEqual([
      {
        id: "00000000-0000-4000-8000-00000000bb01" as TagId,
        name: "Fire",
        color: "#ff0000",
      },
    ]);
  });

  it("handles null color", () => {
    const rows: ItemTagRow[] = [
      {
        item_id: "00000000-0000-4000-8000-00000000aa01",
        tag_id: "00000000-0000-4000-8000-00000000bb01",
        tag_name: "Uncolored",
        color: null,
      },
    ];
    const result = buildItemTagMap(rows);

    expect(
      result.get("00000000-0000-4000-8000-00000000aa01" as ItemId)
    ).toEqual([
      {
        id: "00000000-0000-4000-8000-00000000bb01" as TagId,
        name: "Uncolored",
        color: null,
      },
    ]);
  });

  it("groups multiple tags under the same item", () => {
    const rows: ItemTagRow[] = [
      {
        item_id: "00000000-0000-4000-8000-00000000aa01",
        tag_id: "00000000-0000-4000-8000-00000000bb01",
        tag_name: "Fire",
        color: "#ff0000",
      },
      {
        item_id: "00000000-0000-4000-8000-00000000aa01",
        tag_id: "00000000-0000-4000-8000-00000000bb02",
        tag_name: "Stage",
        color: null,
      },
    ];
    const result = buildItemTagMap(rows);

    expect(result.size).toBe(1);
    const tags = result.get("00000000-0000-4000-8000-00000000aa01" as ItemId);
    expect(tags).toHaveLength(2);
    expect(tags).toEqual([
      {
        id: "00000000-0000-4000-8000-00000000bb01" as TagId,
        name: "Fire",
        color: "#ff0000",
      },
      {
        id: "00000000-0000-4000-8000-00000000bb02" as TagId,
        name: "Stage",
        color: null,
      },
    ]);
  });

  it("separates tags from different items", () => {
    const rows: ItemTagRow[] = [
      {
        item_id: "00000000-0000-4000-8000-00000000aa01",
        tag_id: "00000000-0000-4000-8000-00000000bb01",
        tag_name: "Fire",
        color: "#ff0000",
      },
      {
        item_id: "00000000-0000-4000-8000-00000000aa02",
        tag_id: "00000000-0000-4000-8000-00000000bb02",
        tag_name: "Stage",
        color: "#0000ff",
      },
    ];
    const result = buildItemTagMap(rows);

    expect(result.size).toBe(2);
    expect(
      result.get("00000000-0000-4000-8000-00000000aa01" as ItemId)
    ).toHaveLength(1);
    expect(
      result.get("00000000-0000-4000-8000-00000000aa02" as ItemId)
    ).toHaveLength(1);
  });

  it("handles mixed items with multiple tags each", () => {
    const rows: ItemTagRow[] = [
      {
        item_id: "00000000-0000-4000-8000-00000000aa01",
        tag_id: "00000000-0000-4000-8000-00000000bb01",
        tag_name: "Fire",
        color: "#ff0000",
      },
      {
        item_id: "00000000-0000-4000-8000-00000000aa02",
        tag_id: "00000000-0000-4000-8000-00000000bb02",
        tag_name: "Stage",
        color: "#0000ff",
      },
      {
        item_id: "00000000-0000-4000-8000-00000000aa01",
        tag_id: "00000000-0000-4000-8000-00000000bb03",
        tag_name: "Close-up",
        color: null,
      },
      {
        item_id: "00000000-0000-4000-8000-00000000aa02",
        tag_id: "00000000-0000-4000-8000-00000000bb04",
        tag_name: "Parlor",
        color: "#00ff00",
      },
    ];
    const result = buildItemTagMap(rows);

    expect(result.size).toBe(2);
    expect(
      result.get("00000000-0000-4000-8000-00000000aa01" as ItemId)
    ).toHaveLength(2);
    expect(
      result.get("00000000-0000-4000-8000-00000000aa02" as ItemId)
    ).toHaveLength(2);
  });
});

describe("buildItemTrickMap", () => {
  it("returns empty map for empty array", () => {
    const result = buildItemTrickMap([]);
    expect(result.size).toBe(0);
  });

  it("maps single item with one trick", () => {
    const rows: ItemTrickRow[] = [
      {
        item_id: "00000000-0000-4000-8000-00000000aa01",
        trick_id: "00000000-0000-4000-8000-00000000cc01",
        trick_name: "Ambitious Card",
      },
    ];
    const result = buildItemTrickMap(rows);

    expect(result.size).toBe(1);
    expect(
      result.get("00000000-0000-4000-8000-00000000aa01" as ItemId)
    ).toEqual([
      {
        id: "00000000-0000-4000-8000-00000000cc01" as TrickId,
        name: "Ambitious Card",
      },
    ]);
  });

  it("groups multiple tricks under the same item", () => {
    const rows: ItemTrickRow[] = [
      {
        item_id: "00000000-0000-4000-8000-00000000aa01",
        trick_id: "00000000-0000-4000-8000-00000000cc01",
        trick_name: "Ambitious Card",
      },
      {
        item_id: "00000000-0000-4000-8000-00000000aa01",
        trick_id: "00000000-0000-4000-8000-00000000cc02",
        trick_name: "Triumph",
      },
    ];
    const result = buildItemTrickMap(rows);

    expect(result.size).toBe(1);
    const tricks = result.get("00000000-0000-4000-8000-00000000aa01" as ItemId);
    expect(tricks).toHaveLength(2);
    expect(tricks).toEqual([
      {
        id: "00000000-0000-4000-8000-00000000cc01" as TrickId,
        name: "Ambitious Card",
      },
      {
        id: "00000000-0000-4000-8000-00000000cc02" as TrickId,
        name: "Triumph",
      },
    ]);
  });

  it("separates tricks from different items", () => {
    const rows: ItemTrickRow[] = [
      {
        item_id: "00000000-0000-4000-8000-00000000aa01",
        trick_id: "00000000-0000-4000-8000-00000000cc01",
        trick_name: "Ambitious Card",
      },
      {
        item_id: "00000000-0000-4000-8000-00000000aa02",
        trick_id: "00000000-0000-4000-8000-00000000cc02",
        trick_name: "Triumph",
      },
    ];
    const result = buildItemTrickMap(rows);

    expect(result.size).toBe(2);
    expect(
      result.get("00000000-0000-4000-8000-00000000aa01" as ItemId)
    ).toHaveLength(1);
    expect(
      result.get("00000000-0000-4000-8000-00000000aa02" as ItemId)
    ).toHaveLength(1);
  });

  it("handles mixed items with multiple tricks each", () => {
    const rows: ItemTrickRow[] = [
      {
        item_id: "00000000-0000-4000-8000-00000000aa01",
        trick_id: "00000000-0000-4000-8000-00000000cc01",
        trick_name: "Ambitious Card",
      },
      {
        item_id: "00000000-0000-4000-8000-00000000aa02",
        trick_id: "00000000-0000-4000-8000-00000000cc02",
        trick_name: "Triumph",
      },
      {
        item_id: "00000000-0000-4000-8000-00000000aa01",
        trick_id: "00000000-0000-4000-8000-00000000cc03",
        trick_name: "Oil and Water",
      },
      {
        item_id: "00000000-0000-4000-8000-00000000aa02",
        trick_id: "00000000-0000-4000-8000-00000000cc04",
        trick_name: "Reset",
      },
    ];
    const result = buildItemTrickMap(rows);

    expect(result.size).toBe(2);
    expect(
      result.get("00000000-0000-4000-8000-00000000aa01" as ItemId)
    ).toHaveLength(2);
    expect(
      result.get("00000000-0000-4000-8000-00000000aa02" as ItemId)
    ).toHaveLength(2);
  });
});
