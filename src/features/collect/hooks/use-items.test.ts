import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

vi.mock("@powersync/react", () => ({
  useQuery: mockUseQuery,
  usePowerSync: vi.fn(),
}));

import { buildItemsQuery, useItems } from "./use-items";

describe("useItems hook", () => {
  it("returns empty items when data is empty", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    const { result } = renderHook(() => useItems());
    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns isLoading true while loading", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: true, error: null });
    const { result } = renderHook(() => useItems());
    expect(result.current.isLoading).toBe(true);
  });

  it("returns error when useQuery returns an error", () => {
    const err = new Error("db error");
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: err,
    });
    const { result } = renderHook(() => useItems());
    expect(result.current.error).toBe(err);
  });

  it("returns null error when useQuery error is undefined", () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: undefined,
    });
    const { result } = renderHook(() => useItems());
    expect(result.current.error).toBeNull();
  });

  it("parses raw SQL rows into typed ParsedItem objects", () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: "00000000-0000-4000-8000-0000000000ab",
          name: "Invisible Deck",
          type: "deck",
          description: "A classic effect",
          brand: "Bicycle",
          condition: "new",
          location: "Close-up case",
          notes: "Keep dry",
          purchase_date: "2025-01-10",
          purchase_price: "29.99",
          quantity: "2",
          creator: "Bob Ostin",
          url: "https://example.com",
          created_at: "2025-01-15T12:00:00.000Z",
          updated_at: "2025-01-15T12:00:00.000Z",
        },
      ],
      isLoading: false,
      error: null,
    });
    const { result } = renderHook(() => useItems());

    expect(result.current.items).toHaveLength(1);
    const item = result.current.items[0];
    expect(item).toBeDefined();
    expect(item?.id).toBe("00000000-0000-4000-8000-0000000000ab");
    expect(item?.name).toBe("Invisible Deck");
    expect(item?.type).toBe("deck");
    expect(item?.description).toBe("A classic effect");
    expect(item?.brand).toBe("Bicycle");
    expect(item?.condition).toBe("new");
    expect(item?.location).toBe("Close-up case");
    expect(item?.notes).toBe("Keep dry");
    expect(item?.purchaseDate).toBe("2025-01-10");
    expect(item?.purchasePrice).toBe(29.99);
    expect(item?.quantity).toBe(2);
    expect(item?.creator).toBe("Bob Ostin");
    expect(item?.url).toBe("https://example.com");
    expect(item?.createdAt).toBe("2025-01-15T12:00:00.000Z");
    expect(item?.updatedAt).toBe("2025-01-15T12:00:00.000Z");
  });

  it("passes search option through to buildItemsQuery", () => {
    mockUseQuery.mockClear();
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    renderHook(() => useItems({ search: "bicycle" }));
    const calledSql: string = mockUseQuery.mock.calls[0]?.[0];
    expect(calledSql).toContain("LIKE ?");
  });

  it("passes type filter option through to buildItemsQuery", () => {
    mockUseQuery.mockClear();
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    renderHook(() => useItems({ type: "book" }));
    const calledSql: string = mockUseQuery.mock.calls[0]?.[0];
    expect(calledSql).toContain("type = ?");
  });

  it("passes condition filter option through to buildItemsQuery", () => {
    mockUseQuery.mockClear();
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    renderHook(() => useItems({ condition: "new" }));
    const calledSql: string = mockUseQuery.mock.calls[0]?.[0];
    expect(calledSql).toContain("condition = ?");
  });
});

describe("buildItemsQuery", () => {
  it("returns default query with no filters", () => {
    const { sql, params } = buildItemsQuery();

    expect(sql).toBe(
      "SELECT * FROM items WHERE deleted_at IS NULL ORDER BY created_at DESC"
    );
    expect(params).toEqual([]);
  });

  it("returns default query when options are empty", () => {
    const { sql, params } = buildItemsQuery({});

    expect(sql).toBe(
      "SELECT * FROM items WHERE deleted_at IS NULL ORDER BY created_at DESC"
    );
    expect(params).toEqual([]);
  });

  it("adds search filter for name, description, and brand", () => {
    const { sql, params } = buildItemsQuery({ search: "bicycle" });

    expect(sql).toContain(
      "(name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR brand LIKE ? ESCAPE '\\')"
    );
    expect(params).toEqual(["%bicycle%", "%bicycle%", "%bicycle%"]);
  });

  it("escapes % in search term", () => {
    const { params } = buildItemsQuery({ search: "100%" });
    expect(params).toEqual(["%100\\%%", "%100\\%%", "%100\\%%"]);
  });

  it("escapes _ in search term", () => {
    const { params } = buildItemsQuery({ search: "a_b" });
    expect(params).toEqual(["%a\\_b%", "%a\\_b%", "%a\\_b%"]);
  });

  it("escapes backslash in search term", () => {
    const { params } = buildItemsQuery({ search: "a\\b" });
    expect(params).toEqual(["%a\\\\b%", "%a\\\\b%", "%a\\\\b%"]);
  });

  it("escapes multiple special characters in search term", () => {
    const { params } = buildItemsQuery({ search: "%_\\" });
    expect(params).toEqual(["%\\%\\_\\\\%", "%\\%\\_\\\\%", "%\\%\\_\\\\%"]);
  });

  it("ignores empty search string", () => {
    const { sql, params } = buildItemsQuery({ search: "" });

    expect(sql).toBe(
      "SELECT * FROM items WHERE deleted_at IS NULL ORDER BY created_at DESC"
    );
    expect(params).toEqual([]);
  });

  it("does not trim whitespace-only search string", () => {
    const { sql, params } = buildItemsQuery({ search: "   " });

    expect(sql).toContain(
      "(name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR brand LIKE ? ESCAPE '\\')"
    );
    expect(params).toEqual(["%   %", "%   %", "%   %"]);
  });

  it("adds type filter", () => {
    const { sql, params } = buildItemsQuery({ type: "book" });

    expect(sql).toContain("type = ?");
    expect(params).toContain("book");
  });

  it("ignores null type filter", () => {
    const { sql, params } = buildItemsQuery({ type: null });

    expect(sql).toBe(
      "SELECT * FROM items WHERE deleted_at IS NULL ORDER BY created_at DESC"
    );
    expect(params).toEqual([]);
  });

  it("adds condition filter", () => {
    const { sql, params } = buildItemsQuery({ condition: "new" });

    expect(sql).toContain("condition = ?");
    expect(params).toContain("new");
  });

  it("ignores null condition filter", () => {
    const { sql, params } = buildItemsQuery({ condition: null });

    expect(sql).toBe(
      "SELECT * FROM items WHERE deleted_at IS NULL ORDER BY created_at DESC"
    );
    expect(params).toEqual([]);
  });

  it("combines search, type, and condition filters with AND", () => {
    const { sql, params } = buildItemsQuery({
      search: "trick",
      type: "book",
      condition: "good",
    });

    expect(sql).toContain("deleted_at IS NULL");
    expect(sql).toContain(
      "(name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR brand LIKE ? ESCAPE '\\')"
    );
    expect(sql).toContain("type = ?");
    expect(sql).toContain("condition = ?");
    expect(params).toEqual(["%trick%", "%trick%", "%trick%", "book", "good"]);
  });

  it("all conditions join with AND", () => {
    const { sql } = buildItemsQuery({
      search: "test",
      type: "prop",
      condition: "new",
    });
    const whereClause = sql.split("WHERE ")[1]?.split(" ORDER BY")[0];
    expect(whereClause).toContain("AND");
  });

  describe("sort options", () => {
    it("sorts by newest by default", () => {
      const { sql } = buildItemsQuery();
      expect(sql.endsWith("ORDER BY created_at DESC")).toBe(true);
    });

    it("sorts by name ascending", () => {
      const { sql } = buildItemsQuery({ sort: "name-asc" });
      expect(sql.endsWith("ORDER BY name ASC")).toBe(true);
    });

    it("sorts by name descending", () => {
      const { sql } = buildItemsQuery({ sort: "name-desc" });
      expect(sql.endsWith("ORDER BY name DESC")).toBe(true);
    });

    it("sorts by newest", () => {
      const { sql } = buildItemsQuery({ sort: "newest" });
      expect(sql.endsWith("ORDER BY created_at DESC")).toBe(true);
    });

    it("sorts by oldest", () => {
      const { sql } = buildItemsQuery({ sort: "oldest" });
      expect(sql.endsWith("ORDER BY created_at ASC")).toBe(true);
    });

    it("sorts by type", () => {
      const { sql } = buildItemsQuery({ sort: "type-asc" });
      expect(sql.endsWith("ORDER BY type ASC, name ASC")).toBe(true);
    });

    it("sorts by price ascending (NULLS LAST)", () => {
      const { sql } = buildItemsQuery({ sort: "price-asc" });
      expect(
        sql.endsWith("ORDER BY CAST(purchase_price AS REAL) ASC NULLS LAST")
      ).toBe(true);
    });

    it("sorts by price descending (NULLS LAST)", () => {
      const { sql } = buildItemsQuery({ sort: "price-desc" });
      expect(
        sql.endsWith("ORDER BY CAST(purchase_price AS REAL) DESC NULLS LAST")
      ).toBe(true);
    });

    it("defaults to newest when sort is not specified", () => {
      const { sql } = buildItemsQuery({});
      expect(sql.endsWith("ORDER BY created_at DESC")).toBe(true);
    });
  });
});
