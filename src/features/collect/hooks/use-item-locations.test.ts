import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

vi.mock("@powersync/react", () => ({
  useQuery: mockUseQuery,
  usePowerSync: vi.fn(),
}));

import { useItemLocations } from "./use-item-locations";

describe("useItemLocations hook", () => {
  it("returns empty locations when data is empty", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    const { result } = renderHook(() => useItemLocations());
    expect(result.current.locations).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("maps row.location to a string array", () => {
    mockUseQuery.mockReturnValue({
      data: [
        { location: "Close-up case" },
        { location: "Stage case" },
        { location: "Storage room" },
      ],
      isLoading: false,
      error: null,
    });
    const { result } = renderHook(() => useItemLocations());
    expect(result.current.locations).toEqual([
      "Close-up case",
      "Stage case",
      "Storage room",
    ]);
  });

  it("surfaces useQuery error", () => {
    const err = new Error("query failed");
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: err });
    const { result } = renderHook(() => useItemLocations());
    expect(result.current.error).toBe(err);
  });

  it("returns null error when useQuery error is undefined", () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: undefined,
    });
    const { result } = renderHook(() => useItemLocations());
    expect(result.current.error).toBeNull();
  });

  it("issues a SQL query that selects DISTINCT non-empty locations", () => {
    mockUseQuery.mockClear();
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    renderHook(() => useItemLocations());

    const sql = mockUseQuery.mock.calls[0]?.[0] as string;
    expect(sql).toContain("SELECT DISTINCT location FROM items");
    expect(sql).toContain("deleted_at IS NULL");
    expect(sql).toContain("location IS NOT NULL");
    expect(sql).toContain("location != ''");
    expect(sql).toContain("ORDER BY location ASC");
  });
});
