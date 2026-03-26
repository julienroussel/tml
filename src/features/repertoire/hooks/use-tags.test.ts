import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

vi.mock("@powersync/react", () => ({
  useQuery: mockUseQuery,
  usePowerSync: vi.fn(),
}));

import { useTags } from "./use-tags";

describe("useTags", () => {
  it("returns empty tags and isLoading false when there are no rows", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    const { result } = renderHook(() => useTags());
    expect(result.current.tags).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("returns isLoading true while loading", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: true });
    const { result } = renderHook(() => useTags());
    expect(result.current.isLoading).toBe(true);
  });

  it("maps rows to ParsedTag objects with correct shape", () => {
    mockUseQuery.mockReturnValue({
      data: [
        { id: "tag-1", name: "Beginner", color: "#ff0000" },
        { id: "tag-2", name: "Coin", color: null },
      ],
      isLoading: false,
    });
    const { result } = renderHook(() => useTags());
    expect(result.current.tags).toEqual([
      { id: "tag-1", name: "Beginner", color: "#ff0000" },
      { id: "tag-2", name: "Coin", color: null },
    ]);
  });

  it("calls useQuery with the correct SQL", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderHook(() => useTags());
    const calledSql: string = mockUseQuery.mock.calls[0]?.[0];
    expect(calledSql).toContain("SELECT id, name, color FROM tags");
    expect(calledSql).toContain("deleted_at IS NULL");
    expect(calledSql).toContain("ORDER BY name ASC");
  });
});
