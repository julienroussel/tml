import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

vi.mock("@powersync/react", () => ({
  useQuery: mockUseQuery,
  usePowerSync: vi.fn(),
}));

import { useTrickEffectTypes } from "./use-trick-effect-types";

describe("useTrickEffectTypes", () => {
  it("returns an empty array when there are no rows", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    const { result } = renderHook(() => useTrickEffectTypes());
    expect(result.current).toEqual([]);
  });

  it("returns mapped effect_type strings from rows", () => {
    mockUseQuery.mockReturnValue({
      data: [{ effect_type: "Production" }, { effect_type: "Vanish" }],
      isLoading: false,
    });
    const { result } = renderHook(() => useTrickEffectTypes());
    expect(result.current).toEqual(["Production", "Vanish"]);
  });

  it("calls useQuery with the correct SQL", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderHook(() => useTrickEffectTypes());
    const calledSql: string = mockUseQuery.mock.calls[0]?.[0];
    expect(calledSql).toContain("SELECT DISTINCT effect_type FROM tricks");
    expect(calledSql).toContain("deleted_at IS NULL");
    expect(calledSql).toContain("ORDER BY effect_type ASC");
  });
});
