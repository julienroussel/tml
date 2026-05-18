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
    // mockReset (not mockClear) so a future test that forgets to set
    // mockReturnValue doesn't silently inherit the previous test's return shape.
    mockUseQuery.mockReset();
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

  // ---------------------------------------------------------------------
  // hasSettled — per-id settle latch for not-found detection (issue #287)
  // ---------------------------------------------------------------------

  it("reports hasSettled false while isLoading is true", () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: true,
      isFetching: false,
      error: null,
    });
    const { result } = renderHook(() =>
      useItem(itemId("00000000-0000-4000-8000-000000000100"))
    );

    expect(result.current.hasSettled).toBe(false);
  });

  it("reports hasSettled false while isFetching is true (covers stale-isLoading-false quirk)", () => {
    // On the first render after id change, PowerSync may report
    // isLoading:false from the stale prior query; isFetching:true is the
    // signal that the new id's data is still in flight. hasSettled must
    // stay false in that window.
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: true,
      error: null,
    });
    const { result } = renderHook(() =>
      useItem(itemId("00000000-0000-4000-8000-000000000100"))
    );

    expect(result.current.hasSettled).toBe(false);
  });

  it("latches hasSettled true once both isLoading and isFetching are false", () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: null,
    });
    const { result } = renderHook(() =>
      useItem(itemId("00000000-0000-4000-8000-000000000100"))
    );

    expect(result.current.hasSettled).toBe(true);
  });

  it("keeps hasSettled true through a subsequent isFetching flicker (issue #287 regression)", () => {
    // After the query settles for id, an unrelated `items`-table re-emit
    // re-runs the watched query with isFetching:true. The folded isLoading
    // flickers, but hasSettled must stay sticky — otherwise the
    // settledMissing close+toast can never latch during sync churn.
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
    const { result, rerender } = renderHook(() =>
      useItem(itemId("00000000-0000-4000-8000-000000000100"))
    );

    expect(result.current.hasSettled).toBe(true);

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
      isFetching: true, // sync-churn flicker on unrelated row update — data stays populated
      error: null,
    });
    rerender();

    expect(result.current.hasSettled).toBe(true);
    expect(result.current.isLoading).toBe(true); // fold is still busy — that's expected
  });

  it("resets hasSettled when the id changes to a new value", () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: null,
    });
    const { result, rerender } = renderHook(
      ({ id }: { id: ItemId | null }) => useItem(id),
      {
        initialProps: {
          id: itemId("00000000-0000-4000-8000-000000000100") as ItemId | null,
        },
      }
    );

    expect(result.current.hasSettled).toBe(true);

    // Switching target: PowerSync stale-isLoading-false quirk → isFetching:true
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: true,
      error: null,
    });
    rerender({ id: itemId("00000000-0000-4000-8000-000000000200") });

    // hasSettled must NOT bleed across to the new id
    expect(result.current.hasSettled).toBe(false);
  });

  it("resets hasSettled when id transitions to null and back to the same value", () => {
    // Sheet close (id → null) then re-open same id (null → A) must clear
    // the prior settle latch — the new query hasn't run yet.
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: null,
    });
    const { result, rerender } = renderHook(
      ({ id }: { id: ItemId | null }) => useItem(id),
      {
        initialProps: {
          id: itemId("00000000-0000-4000-8000-000000000100") as ItemId | null,
        },
      }
    );

    expect(result.current.hasSettled).toBe(true);

    rerender({ id: null });
    expect(result.current.hasSettled).toBe(false);

    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: true,
      error: null,
    });
    rerender({ id: itemId("00000000-0000-4000-8000-000000000100") });
    expect(result.current.hasSettled).toBe(false);
  });

  it("returns parsed item, error, and hasSettled=true when data and error are both populated", () => {
    // PowerSync can surface a non-null error alongside a non-null data array
    // on partial query failures. The hook must propagate all three signals
    // (item, error, hasSettled) — a refactor that short-circuits on error
    // before parsing the row would silently drop the item.
    const queryError = new Error("partial failure");
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
      error: queryError,
    });

    const { result } = renderHook(() =>
      useItem(itemId("00000000-0000-4000-8000-000000000100"))
    );

    expect(result.current.item).not.toBeNull();
    expect(result.current.item?.id).toBe(
      "00000000-0000-4000-8000-000000000100"
    );
    expect(result.current.error).toBe(queryError);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasSettled).toBe(true);
  });

  // ---------------------------------------------------------------------
  // hasSettled — data-identity cross-check (defense against stale-row latch)
  // ---------------------------------------------------------------------

  it("does not latch hasSettled and returns item=null when data still holds a different id (PowerSync stale-flag race)", () => {
    // On the first render after an id change, PowerSync's useWatchedQuery can
    // briefly report !isLoading && !isFetching while `data` still contains
    // the previous query's row. Both guards must fire together: the latch
    // stays unlatched (hasSettled=false) AND the returned `item` is null
    // rather than the stale row — keeps the two signals on the same trust
    // boundary so a future caller can rely on "hasSettled=true implies item
    // is the value for id".
    const targetId = "00000000-0000-4000-8000-000000000200";
    const staleRowId = "00000000-0000-4000-8000-000000000100";
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: staleRowId,
          name: "Stale Item",
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

    const { result } = renderHook(() => useItem(itemId(targetId)));

    expect(result.current.hasSettled).toBe(false);
    expect(result.current.item).toBeNull();
  });

  it("latches hasSettled when data is empty (settled-missing is a valid settle)", () => {
    // The empty-data branch of the data-identity guard: a settled-missing row
    // (deleted on another device) must still latch hasSettled so the
    // close+toast effect in collect-view can fire.
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: null,
    });
    const { result } = renderHook(() =>
      useItem(itemId("00000000-0000-4000-8000-000000000100"))
    );

    expect(result.current.hasSettled).toBe(true);
  });
});
