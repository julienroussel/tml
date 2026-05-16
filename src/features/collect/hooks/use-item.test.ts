import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ItemId } from "@/db/types";

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

vi.mock("@powersync/react", () => ({
  useQuery: mockUseQuery,
  usePowerSync: vi.fn(),
}));

import { useItem } from "./use-item";

const itemId = (id: string) => id as ItemId;

describe("useItem", () => {
  afterEach(() => {
    mockUseQuery.mockClear();
  });

  it("returns null item when id is null", () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: null,
    });
    const { result } = renderHook(() => useItem(null));

    expect(result.current.item).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("forces isLoading false on the null-id early return even when the query reports loading", () => {
    // The `!id` branch returns before the isFetching fold — a stray
    // isLoading/isFetching:true from the no-op query must not leak through.
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: true,
      isFetching: true,
      error: null,
    });
    const { result } = renderHook(() => useItem(null));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.item).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("uses a no-op SQL query when id is null", () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: null,
    });
    renderHook(() => useItem(null));

    const calledSql: string = mockUseQuery.mock.calls[0]?.[0];
    expect(calledSql).toBe("SELECT 1 WHERE 0");
    expect(mockUseQuery.mock.calls[0]?.[1]).toEqual([]);
  });

  it("queries by id when id is provided", () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: null,
    });
    renderHook(() => useItem(itemId("00000000-0000-4000-8000-000000000100")));

    const calledSql: string = mockUseQuery.mock.calls[0]?.[0];
    expect(calledSql).toContain("WHERE id = ?");
    expect(calledSql).toContain("deleted_at IS NULL");
    expect(mockUseQuery.mock.calls[0]?.[1]).toEqual([
      "00000000-0000-4000-8000-000000000100",
    ]);
  });

  it("parses the row when data is returned", () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: "00000000-0000-4000-8000-000000000100",
          name: "Test Item",
          type: "prop",
          brand: null,
          condition: null,
          created_at: "2025-01-15T12:00:00.000Z",
          creator: null,
          description: null,
          location: null,
          notes: null,
          purchase_date: null,
          purchase_price: null,
          quantity: 1,
          updated_at: "2025-01-15T12:00:00.000Z",
          url: null,
        },
      ],
      isLoading: false,
      isFetching: false,
      error: null,
    });

    const { result } = renderHook(() =>
      useItem(itemId("00000000-0000-4000-8000-000000000100"))
    );

    expect(result.current.item).not.toBeNull();
    expect(result.current.item?.id).toBe(
      "00000000-0000-4000-8000-000000000100"
    );
    expect(result.current.item?.name).toBe("Test Item");
    expect(result.current.item?.type).toBe("prop");
  });

  it("returns null item when data is empty", () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: null,
    });
    const { result } = renderHook(() =>
      useItem(itemId("00000000-0000-4000-8000-000000000100"))
    );

    expect(result.current.item).toBeNull();
  });

  it("passes through isLoading state", () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: true,
      isFetching: false,
      error: null,
    });
    const { result } = renderHook(() =>
      useItem(itemId("00000000-0000-4000-8000-000000000100"))
    );

    expect(result.current.isLoading).toBe(true);
  });

  it("folds isFetching into isLoading so a query-param change still reports loading", () => {
    // PowerSync's useWatchedQuery reports the previous query's isLoading
    // (false) on the first render after the id changes; isFetching covers it.
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: true,
      error: null,
    });
    const { result } = renderHook(() =>
      useItem(itemId("00000000-0000-4000-8000-000000000100"))
    );

    expect(result.current.isLoading).toBe(true);
  });

  it("reports not-loading once the query is fully settled (isFetching false)", () => {
    // The non-loading branch of the isFetching fold: a fully-settled query
    // (isLoading:false AND isFetching:false) must surface isLoading:false.
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: "00000000-0000-4000-8000-000000000100",
          name: "Test Item",
          type: "prop",
          brand: null,
          condition: null,
          created_at: "2025-01-15T12:00:00.000Z",
          creator: null,
          description: null,
          location: null,
          notes: null,
          purchase_date: null,
          purchase_price: null,
          quantity: 1,
          updated_at: "2025-01-15T12:00:00.000Z",
          url: null,
        },
      ],
      isLoading: false,
      isFetching: false,
      error: null,
    });
    const { result } = renderHook(() =>
      useItem(itemId("00000000-0000-4000-8000-000000000100"))
    );

    expect(result.current.isLoading).toBe(false);
  });

  it("returns error when useQuery fails", () => {
    const err = new Error("db error");
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: err,
    });
    const { result } = renderHook(() =>
      useItem(itemId("00000000-0000-4000-8000-000000000100"))
    );

    expect(result.current.error).toBe(err);
  });

  it("returns null error when useQuery error is undefined", () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: undefined,
    });
    const { result } = renderHook(() =>
      useItem(itemId("00000000-0000-4000-8000-000000000100"))
    );

    expect(result.current.error).toBeNull();
  });
});
