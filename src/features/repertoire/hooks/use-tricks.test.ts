import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

vi.mock("@powersync/react", () => ({
  useQuery: mockUseQuery,
  usePowerSync: vi.fn(),
}));

import { buildTricksQuery, useTricks } from "./use-tricks";

describe("useTricks hook", () => {
  it("returns empty tricks when data is empty", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    const { result } = renderHook(() => useTricks());
    expect(result.current.tricks).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns isLoading true while loading", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: true, error: null });
    const { result } = renderHook(() => useTricks());
    expect(result.current.isLoading).toBe(true);
  });

  it("returns error when useQuery returns an error", () => {
    const err = new Error("db error");
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: err,
    });
    const { result } = renderHook(() => useTricks());
    expect(result.current.error).toBe(err);
  });

  it("passes options through to buildTricksQuery", () => {
    mockUseQuery.mockClear();
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    renderHook(() => useTricks({ search: "card", status: "new" }));
    const calledSql: string = mockUseQuery.mock.calls[0]?.[0];
    expect(calledSql).toContain("LIKE ?");
    expect(calledSql).toContain("status = ?");
  });
});

describe("buildTricksQuery", () => {
  it("returns default query with no filters", () => {
    const { sql, params } = buildTricksQuery();

    expect(sql).toBe(
      "SELECT * FROM tricks WHERE deleted_at IS NULL ORDER BY created_at DESC"
    );
    expect(params).toEqual([]);
  });

  it("returns default query when options are empty", () => {
    const { sql, params } = buildTricksQuery({});

    expect(sql).toBe(
      "SELECT * FROM tricks WHERE deleted_at IS NULL ORDER BY created_at DESC"
    );
    expect(params).toEqual([]);
  });

  it("adds search filter with escaped LIKE pattern", () => {
    const { sql, params } = buildTricksQuery({ search: "card" });

    expect(sql).toContain(
      "(name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')"
    );
    expect(params).toEqual(["%card%", "%card%"]);
  });

  it("escapes % in search term", () => {
    const { params } = buildTricksQuery({ search: "100%" });

    expect(params).toEqual(["%100\\%%", "%100\\%%"]);
  });

  it("escapes _ in search term", () => {
    const { params } = buildTricksQuery({ search: "a_b" });

    expect(params).toEqual(["%a\\_b%", "%a\\_b%"]);
  });

  it("escapes backslash in search term", () => {
    const { params } = buildTricksQuery({ search: "a\\b" });

    expect(params).toEqual(["%a\\\\b%", "%a\\\\b%"]);
  });

  it("escapes multiple special characters in search term", () => {
    const { params } = buildTricksQuery({ search: "%_\\" });

    expect(params).toEqual(["%\\%\\_\\\\%", "%\\%\\_\\\\%"]);
  });

  it("ignores empty search string", () => {
    const { sql, params } = buildTricksQuery({ search: "" });

    expect(sql).toBe(
      "SELECT * FROM tricks WHERE deleted_at IS NULL ORDER BY created_at DESC"
    );
    expect(params).toEqual([]);
  });

  it("adds status filter", () => {
    const { sql, params } = buildTricksQuery({ status: "learning" });

    expect(sql).toContain("status = ?");
    expect(params).toEqual(["learning"]);
  });

  it("adds category filter", () => {
    const { sql, params } = buildTricksQuery({ category: "cards" });

    expect(sql).toContain("category = ?");
    expect(params).toEqual(["cards"]);
  });

  it("combines all filters", () => {
    const { sql, params } = buildTricksQuery({
      search: "trick",
      status: "mastered",
      category: "coins",
    });

    expect(sql).toContain("deleted_at IS NULL");
    expect(sql).toContain(
      "(name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')"
    );
    expect(sql).toContain("status = ?");
    expect(sql).toContain("category = ?");
    expect(params).toEqual(["%trick%", "%trick%", "mastered", "coins"]);
  });

  it("ignores null status and category", () => {
    const { sql, params } = buildTricksQuery({
      status: null,
      category: null,
    });

    expect(sql).toBe(
      "SELECT * FROM tricks WHERE deleted_at IS NULL ORDER BY created_at DESC"
    );
    expect(params).toEqual([]);
  });

  describe("sort options", () => {
    it("sorts by name ascending", () => {
      const { sql } = buildTricksQuery({ sort: "name_asc" });
      expect(sql.endsWith("ORDER BY name ASC")).toBe(true);
    });

    it("sorts by name descending", () => {
      const { sql } = buildTricksQuery({ sort: "name_desc" });
      expect(sql.endsWith("ORDER BY name DESC")).toBe(true);
    });

    it("sorts by newest", () => {
      const { sql } = buildTricksQuery({ sort: "newest" });
      expect(sql.endsWith("ORDER BY created_at DESC")).toBe(true);
    });

    it("sorts by oldest", () => {
      const { sql } = buildTricksQuery({ sort: "oldest" });
      expect(sql.endsWith("ORDER BY created_at ASC")).toBe(true);
    });

    it("sorts by difficulty", () => {
      const { sql } = buildTricksQuery({ sort: "difficulty" });
      expect(sql.endsWith("ORDER BY difficulty DESC NULLS LAST")).toBe(true);
    });

    it("sorts by status", () => {
      const { sql } = buildTricksQuery({ sort: "status" });
      expect(sql.endsWith("ORDER BY status ASC")).toBe(true);
    });

    it("defaults to newest when sort is not specified", () => {
      const { sql } = buildTricksQuery({});
      expect(sql.endsWith("ORDER BY created_at DESC")).toBe(true);
    });
  });
});
