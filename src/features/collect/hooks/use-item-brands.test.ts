import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

vi.mock("@powersync/react", () => ({
  useQuery: mockUseQuery,
  usePowerSync: vi.fn(),
}));

import { useItemBrands } from "./use-item-brands";

describe("useItemBrands hook", () => {
  it("returns empty brands when data is empty", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    const { result } = renderHook(() => useItemBrands());
    expect(result.current.brands).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("maps row.brand to a string array", () => {
    mockUseQuery.mockReturnValue({
      data: [{ brand: "Bicycle" }, { brand: "Theory11" }, { brand: "TCC" }],
      isLoading: false,
      error: null,
    });
    const { result } = renderHook(() => useItemBrands());
    expect(result.current.brands).toEqual(["Bicycle", "Theory11", "TCC"]);
  });

  it("surfaces useQuery error", () => {
    const err = new Error("query failed");
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: err });
    const { result } = renderHook(() => useItemBrands());
    expect(result.current.error).toBe(err);
  });

  it("returns null error when useQuery error is undefined", () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: undefined,
    });
    const { result } = renderHook(() => useItemBrands());
    expect(result.current.error).toBeNull();
  });

  it("issues a SQL query that selects DISTINCT non-empty brands", () => {
    mockUseQuery.mockClear();
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    renderHook(() => useItemBrands());

    const sql = mockUseQuery.mock.calls[0]?.[0] as string;
    expect(sql).toContain("SELECT DISTINCT brand FROM items");
    expect(sql).toContain("deleted_at IS NULL");
    expect(sql).toContain("brand IS NOT NULL");
    expect(sql).toContain("brand != ''");
    expect(sql).toContain("ORDER BY brand ASC");
  });
});
