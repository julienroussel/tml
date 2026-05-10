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
  it("returns empty effectTypes and null error when there are no rows", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    const { result } = renderHook(() => useTrickEffectTypes());
    expect(result.current.effectTypes).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("returns mapped effect_type strings from rows", () => {
    mockUseQuery.mockReturnValue({
      data: [{ effect_type: "Production" }, { effect_type: "Vanish" }],
      isLoading: false,
      error: null,
    });
    const { result } = renderHook(() => useTrickEffectTypes());
    expect(result.current.effectTypes).toEqual(["Production", "Vanish"]);
  });

  it("surfaces useQuery error", () => {
    const err = new Error("query failed");
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: err });
    const { result } = renderHook(() => useTrickEffectTypes());
    expect(result.current.error).toBe(err);
    expect(result.current.effectTypes).toEqual([]);
  });

  it("returns null error when useQuery error is undefined", () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: undefined,
    });
    const { result } = renderHook(() => useTrickEffectTypes());
    expect(result.current.error).toBeNull();
  });

  it("calls useQuery with the correct SQL", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    renderHook(() => useTrickEffectTypes());
    const calledSql: string = mockUseQuery.mock.calls[0]?.[0];
    expect(calledSql).toContain("SELECT DISTINCT effect_type FROM tricks");
    expect(calledSql).toContain("deleted_at IS NULL");
    expect(calledSql).toContain("ORDER BY effect_type ASC");
  });
});
