import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

vi.mock("@powersync/react", () => ({
  useQuery: mockUseQuery,
  usePowerSync: vi.fn(),
}));

import { useTrickCategories } from "./use-trick-categories";

describe("useTrickCategories", () => {
  it("returns empty categories and null error when there are no rows", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    const { result } = renderHook(() => useTrickCategories());
    expect(result.current.categories).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("returns mapped category strings from rows", () => {
    mockUseQuery.mockReturnValue({
      data: [{ category: "Cards" }, { category: "Coins" }],
      isLoading: false,
      error: null,
    });
    const { result } = renderHook(() => useTrickCategories());
    expect(result.current.categories).toEqual(["Cards", "Coins"]);
  });

  it("surfaces useQuery error", () => {
    const err = new Error("query failed");
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: err });
    const { result } = renderHook(() => useTrickCategories());
    expect(result.current.error).toBe(err);
    expect(result.current.categories).toEqual([]);
  });

  it("returns null error when useQuery error is undefined", () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: undefined,
    });
    const { result } = renderHook(() => useTrickCategories());
    expect(result.current.error).toBeNull();
  });

  it("calls useQuery with the correct SQL", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    renderHook(() => useTrickCategories());
    const calledSql: string = mockUseQuery.mock.calls[0]?.[0];
    expect(calledSql).toContain("SELECT DISTINCT category FROM tricks");
    expect(calledSql).toContain("deleted_at IS NULL");
    expect(calledSql).toContain("ORDER BY category ASC");
  });
});
