import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

vi.mock("@powersync/react", () => ({
  useQuery: mockUseQuery,
  usePowerSync: vi.fn(),
}));

import { useItemCount } from "./use-item-count";

describe("useItemCount hook", () => {
  it("returns 0 when no row is returned", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    const { result } = renderHook(() => useItemCount());
    expect(result.current.count).toBe(0);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns the count from the first row", () => {
    mockUseQuery.mockReturnValue({
      data: [{ count: 7 }],
      isLoading: false,
      error: null,
    });
    const { result } = renderHook(() => useItemCount());
    expect(result.current.count).toBe(7);
    expect(typeof result.current.count).toBe("number");
  });

  it("coerces string counts to numbers (defensive guard against SQLite drivers returning strings)", () => {
    mockUseQuery.mockReturnValue({
      // Cast to satisfy the CountRow type; the runtime guard is the point of
      // this test — ICU plural selectors require a number, not a string.
      data: [{ count: "7" as unknown as number }],
      isLoading: false,
      error: null,
    });
    const { result } = renderHook(() => useItemCount());
    expect(result.current.count).toBe(7);
    expect(typeof result.current.count).toBe("number");
  });

  it("forwards isLoading from useQuery", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: true, error: null });
    const { result } = renderHook(() => useItemCount());
    expect(result.current.isLoading).toBe(true);
  });

  it("surfaces useQuery error", () => {
    const err = new Error("query failed");
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: err });
    const { result } = renderHook(() => useItemCount());
    expect(result.current.error).toBe(err);
  });

  it("returns null error when useQuery error is undefined", () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: undefined,
    });
    const { result } = renderHook(() => useItemCount());
    expect(result.current.error).toBeNull();
  });

  it("issues a COUNT query against items filtered by deleted_at IS NULL", () => {
    mockUseQuery.mockClear();
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    renderHook(() => useItemCount());

    const sql = mockUseQuery.mock.calls[0]?.[0] as string;
    expect(sql).toContain("SELECT COUNT(*)");
    expect(sql).toContain("FROM items");
    expect(sql).toContain("deleted_at IS NULL");
  });
});
