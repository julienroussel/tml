import { describe, expect, it } from "vitest";
import type { ParsedItem } from "../types";
import type { ItemRow } from "./parse-item";
import { parseItemRow } from "./parse-item";

// parseItemRow now returns ParsedItem | null (rejects rows with invalid UUIDs).
// Test helper: assert non-null and narrow for the happy-path tests where
// fixtures use a valid UUID. Tests that exercise the rejection path call
// parseItemRow directly and check for null.
function parseRowOrFail(row: ItemRow): ParsedItem {
  const result = parseItemRow(row);
  if (result === null) {
    throw new Error("parseItemRow returned null for a valid fixture");
  }
  return result;
}

describe("parseItemRow", () => {
  function createMinimalRow(overrides?: Partial<ItemRow>): ItemRow {
    return {
      id: "00000000-0000-4000-8000-000000000001",
      brand: "Bicycle",
      condition: "new",
      created_at: "2025-01-15T12:00:00.000Z",
      creator: "Bob Ostin",
      description: "A classic deck",
      location: "Close-up case",
      name: "Invisible Deck",
      notes: "Keep dry",
      purchase_date: "2025-01-10",
      purchase_price: "29.99",
      quantity: 2,
      type: "deck",
      updated_at: "2025-01-15T13:00:00.000Z",
      url: "https://example.com",
      ...overrides,
    };
  }

  it("maps snake_case to camelCase fields", () => {
    const result = parseRowOrFail(createMinimalRow());

    expect(result.createdAt).toBe("2025-01-15T12:00:00.000Z");
    expect(result.updatedAt).toBe("2025-01-15T13:00:00.000Z");
    expect(result.purchaseDate).toBe("2025-01-10");
    expect(result.purchasePrice).toBe(29.99);
  });

  it("preserves all scalar fields", () => {
    const result = parseRowOrFail(createMinimalRow());

    expect(result.id).toBe("00000000-0000-4000-8000-000000000001");
    expect(result.name).toBe("Invisible Deck");
    expect(result.brand).toBe("Bicycle");
    expect(result.condition).toBe("new");
    expect(result.creator).toBe("Bob Ostin");
    expect(result.description).toBe("A classic deck");
    expect(result.location).toBe("Close-up case");
    expect(result.notes).toBe("Keep dry");
    expect(result.quantity).toBe(2);
    expect(result.type).toBe("deck");
    expect(result.url).toBe("https://example.com");
  });

  it("unknown type defaults to 'other'", () => {
    const result = parseRowOrFail(createMinimalRow({ type: "furniture" }));
    expect(result.type).toBe("other");
  });

  it("accepts all valid ITEM_TYPES without defaulting", () => {
    const validTypes = [
      "prop",
      "book",
      "gimmick",
      "dvd",
      "download",
      "deck",
      "clothing",
      "consumable",
      "accessory",
      "other",
    ] as const;
    for (const type of validTypes) {
      const result = parseRowOrFail(createMinimalRow({ type }));
      expect(result.type).toBe(type);
    }
  });

  it("unknown condition defaults to null", () => {
    const result = parseRowOrFail(createMinimalRow({ condition: "perfect" }));
    expect(result.condition).toBeNull();
  });

  it("null condition stays null", () => {
    const result = parseRowOrFail(createMinimalRow({ condition: null }));
    expect(result.condition).toBeNull();
  });

  it("accepts all valid ITEM_CONDITIONS without defaulting to null", () => {
    const validConditions = ["new", "good", "worn", "needs_repair"] as const;
    for (const condition of validConditions) {
      const result = parseRowOrFail(createMinimalRow({ condition }));
      expect(result.condition).toBe(condition);
    }
  });

  it("null purchase_price returns null", () => {
    const result = parseRowOrFail(createMinimalRow({ purchase_price: null }));
    expect(result.purchasePrice).toBeNull();
  });

  it("valid purchase_price string converts to number", () => {
    const result = parseRowOrFail(
      createMinimalRow({ purchase_price: "49.95" })
    );
    expect(result.purchasePrice).toBe(49.95);
  });

  it("integer purchase_price string converts to number", () => {
    const result = parseRowOrFail(createMinimalRow({ purchase_price: "100" }));
    expect(result.purchasePrice).toBe(100);
  });

  it("purchase_price of '0' converts to 0", () => {
    const result = parseRowOrFail(createMinimalRow({ purchase_price: "0" }));
    expect(result.purchasePrice).toBe(0);
  });

  it("invalid purchase_price string (NaN) returns null", () => {
    const result = parseRowOrFail(createMinimalRow({ purchase_price: "abc" }));
    expect(result.purchasePrice).toBeNull();
  });

  it("null quantity defaults to 1", () => {
    const result = parseRowOrFail(createMinimalRow({ quantity: null }));
    expect(result.quantity).toBe(1);
  });

  it("explicit quantity of 0 is preserved", () => {
    const result = parseRowOrFail(createMinimalRow({ quantity: 0 }));
    expect(result.quantity).toBe(0);
  });

  it("string quantity is parsed to number (PowerSync WASM bridge)", () => {
    const result = parseRowOrFail(createMinimalRow({ quantity: "5" }));
    expect(result.quantity).toBe(5);
  });

  it("string quantity '0' is parsed to 0", () => {
    const result = parseRowOrFail(createMinimalRow({ quantity: "0" }));
    expect(result.quantity).toBe(0);
  });

  it("non-numeric string quantity defaults to 1", () => {
    const result = parseRowOrFail(createMinimalRow({ quantity: "abc" }));
    expect(result.quantity).toBe(1);
  });

  it("empty string quantity defaults to 1", () => {
    const result = parseRowOrFail(createMinimalRow({ quantity: "" }));
    expect(result.quantity).toBe(1);
  });

  it("handles fully null optional fields", () => {
    const result = parseRowOrFail(
      createMinimalRow({
        brand: null,
        condition: null,
        creator: null,
        description: null,
        location: null,
        notes: null,
        purchase_date: null,
        purchase_price: null,
        url: null,
      })
    );

    expect(result.brand).toBeNull();
    expect(result.condition).toBeNull();
    expect(result.creator).toBeNull();
    expect(result.description).toBeNull();
    expect(result.location).toBeNull();
    expect(result.notes).toBeNull();
    expect(result.purchaseDate).toBeNull();
    expect(result.purchasePrice).toBeNull();
    expect(result.url).toBeNull();
  });
});
