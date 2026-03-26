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
  it("returns an empty array when there are no rows", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    const { result } = renderHook(() => useTrickCategories());
    expect(result.current).toEqual([]);
  });

  it("returns mapped category strings from rows", () => {
    mockUseQuery.mockReturnValue({
      data: [{ category: "Cards" }, { category: "Coins" }],
      isLoading: false,
    });
    const { result } = renderHook(() => useTrickCategories());
    expect(result.current).toEqual(["Cards", "Coins"]);
  });

  it("calls useQuery with the correct SQL", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderHook(() => useTrickCategories());
    const calledSql: string = mockUseQuery.mock.calls[0]?.[0];
    expect(calledSql).toContain("SELECT DISTINCT category FROM tricks");
    expect(calledSql).toContain("deleted_at IS NULL");
    expect(calledSql).toContain("ORDER BY category ASC");
  });
});
