import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrickId } from "@/db/types";
import type { TrickRow } from "./parse-trick";

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

vi.mock("@powersync/react", () => ({
  useQuery: mockUseQuery,
  usePowerSync: vi.fn(),
}));

import { useTrick } from "./use-trick";

const trickId = (id: string) => id as TrickId;

const sampleRow: TrickRow = {
  id: "trick-abc",
  name: "Ambitious Card",
  description: "A classic",
  category: "Card",
  effect_type: "Transformation",
  difficulty: 3,
  status: "learning",
  duration: 120,
  performance_type: "close_up",
  angle_sensitivity: "moderate",
  props: "Deck of cards",
  music: null,
  languages: '["en","fr"]',
  is_camera_friendly: 1,
  is_silent: 0,
  notes: "Use Bicycle deck",
  source: "Card College",
  video_url: "https://example.com/video",
  created_at: "2025-01-15T12:00:00.000Z",
  updated_at: "2025-01-15T12:00:00.000Z",
};

describe("useTrick", () => {
  afterEach(() => {
    // mockReset (not mockClear) so a future test that forgets to set
    // mockReturnValue doesn't silently inherit the previous test's return shape.
    mockUseQuery.mockReset();
  });

  it("returns null trick and isLoading false when id is null", () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
    });

    const { result } = renderHook(() => useTrick(null));

    expect(result.current).toEqual({
      trick: null,
      isLoading: false,
      error: null,
      hasSettled: false,
    });
    expect(mockUseQuery).toHaveBeenCalledWith("SELECT 1 WHERE 0", []);
  });

  it("forces isLoading false on the null-id early return even when the disabled query reports loading", () => {
    // The `SELECT 1 WHERE 0` placeholder query can still report
    // isLoading/isFetching true on its first render. The `!id` early return
    // must short-circuit before the isFetching fold so a null id always
    // reads as "not loading" — repertoire-view's deriveSheetMode depends on
    // this to land on { mode: "create" } rather than a stuck skeleton.
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: true,
      isFetching: true,
    });

    const { result } = renderHook(() => useTrick(null));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.trick).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.hasSettled).toBe(false);
  });

  it("returns parsed trick when id matches a row", () => {
    mockUseQuery.mockReturnValue({
      data: [sampleRow],
      isLoading: false,
      isFetching: false,
    });

    const { result } = renderHook(() => useTrick(trickId("trick-abc")));

    expect(mockUseQuery).toHaveBeenCalledWith(
      "SELECT * FROM tricks WHERE id = ? AND deleted_at IS NULL",
      ["trick-abc"]
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.trick).not.toBeNull();
    expect(result.current.trick?.id).toBe("trick-abc");
    expect(result.current.trick?.name).toBe("Ambitious Card");
    expect(result.current.trick?.status).toBe("learning");
    expect(result.current.trick?.isCameraFriendly).toBe(true);
    expect(result.current.trick?.isSilent).toBe(false);
    expect(result.current.trick?.languages).toEqual(["en", "fr"]);
  });

  it("returns null trick when id has no matching data", () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
    });

    const { result } = renderHook(() => useTrick(trickId("nonexistent-id")));

    expect(mockUseQuery).toHaveBeenCalledWith(
      "SELECT * FROM tricks WHERE id = ? AND deleted_at IS NULL",
      ["nonexistent-id"]
    );
    // Structural lock — catches a regression that adds or removes a field
    // (e.g., accidentally dropping hasSettled on the not-found path).
    expect(result.current).toEqual({
      trick: null,
      isLoading: false,
      error: null,
      hasSettled: true,
    });
  });

  it("surfaces error from useQuery when query fails", () => {
    const queryError = new Error("SQLite I/O failure");
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: queryError,
    });

    const { result } = renderHook(() => useTrick(trickId("trick-abc")));

    // Lock the full shape — a regression that propagates `error` but flips
    // `isLoading` to true (stalling the UI) would not fail a property-only
    // assertion but does fail this structural lock.
    expect(result.current).toEqual({
      trick: null,
      isLoading: false,
      error: queryError,
      hasSettled: true,
    });
  });

  it("passes through isLoading from useQuery when id is provided", () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: true,
      isFetching: false,
      error: null,
    });

    const { result } = renderHook(() => useTrick(trickId("trick-abc")));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.trick).toBeNull();
  });

  it("folds isFetching into isLoading so a query-param change still reports loading", () => {
    // PowerSync's useWatchedQuery reports the previous query's isLoading
    // (false) on the first render after the id changes; isFetching covers it.
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: true,
    });

    const { result } = renderHook(() => useTrick(trickId("trick-abc")));

    expect(result.current.isLoading).toBe(true);
  });

  it("reports isLoading false once the query is fully settled", () => {
    // Locks the non-loading branch of the isFetching fold: both isLoading
    // and isFetching false must yield isLoading false.
    mockUseQuery.mockReturnValue({
      data: [sampleRow],
      isLoading: false,
      isFetching: false,
    });

    const { result } = renderHook(() => useTrick(trickId("trick-abc")));

    expect(result.current.isLoading).toBe(false);
  });

  // ---------------------------------------------------------------------
  // hasSettled — per-id settle latch for not-found detection (issue #287)
  // ---------------------------------------------------------------------

  it("reports hasSettled false while isLoading is true", () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: true,
      isFetching: false,
    });

    const { result } = renderHook(() => useTrick(trickId("trick-abc")));

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
    });

    const { result } = renderHook(() => useTrick(trickId("trick-abc")));

    expect(result.current.hasSettled).toBe(false);
  });

  it("latches hasSettled true once both isLoading and isFetching are false", () => {
    mockUseQuery.mockReturnValue({
      data: [sampleRow],
      isLoading: false,
      isFetching: false,
    });

    const { result } = renderHook(() => useTrick(trickId("trick-abc")));

    expect(result.current.hasSettled).toBe(true);
  });

  it("keeps hasSettled true through a subsequent isFetching flicker (issue #287 regression)", () => {
    // After the query settles for id, an unrelated `tricks`-table re-emit
    // re-runs the watched query with isFetching:true. The folded isLoading
    // flickers, but hasSettled must stay sticky — otherwise the
    // settledMissing close+toast can never latch during sync churn.
    mockUseQuery.mockReturnValue({
      data: [sampleRow],
      isLoading: false,
      isFetching: false,
    });

    const { result, rerender } = renderHook(() =>
      useTrick(trickId("trick-abc"))
    );

    expect(result.current.hasSettled).toBe(true);

    mockUseQuery.mockReturnValue({
      data: [sampleRow],
      isLoading: false,
      isFetching: true, // sync-churn flicker on unrelated row update
    });
    rerender();

    expect(result.current.hasSettled).toBe(true);
    expect(result.current.isLoading).toBe(true); // fold is still busy — that's expected
  });

  it("resets hasSettled when the id changes to a new value", () => {
    mockUseQuery.mockReturnValue({
      data: [sampleRow],
      isLoading: false,
      isFetching: false,
    });

    const { result, rerender } = renderHook(
      ({ id }: { id: TrickId | null }) => useTrick(id),
      { initialProps: { id: trickId("trick-abc") as TrickId | null } }
    );

    expect(result.current.hasSettled).toBe(true);

    // Switching target: PowerSync stale-isLoading-false quirk → isFetching:true
    mockUseQuery.mockReturnValue({
      data: [sampleRow],
      isLoading: false,
      isFetching: true,
    });
    rerender({ id: trickId("trick-xyz") });

    // hasSettled must NOT bleed across to the new id
    expect(result.current.hasSettled).toBe(false);
  });

  it("resets hasSettled when id transitions to null and back to the same value", () => {
    // Sheet close (id → null) then re-open same id (null → A) must clear
    // the prior settle latch — the new query hasn't run yet.
    mockUseQuery.mockReturnValue({
      data: [sampleRow],
      isLoading: false,
      isFetching: false,
    });

    const { result, rerender } = renderHook(
      ({ id }: { id: TrickId | null }) => useTrick(id),
      { initialProps: { id: trickId("trick-abc") as TrickId | null } }
    );

    expect(result.current.hasSettled).toBe(true);

    rerender({ id: null });
    expect(result.current.hasSettled).toBe(false);

    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: true,
    });
    rerender({ id: trickId("trick-abc") });
    expect(result.current.hasSettled).toBe(false);
  });

  it("returns parsed trick, error, and hasSettled=true when data and error are both populated", () => {
    // PowerSync can surface a non-null error alongside a non-null data array
    // on partial query failures. The hook must propagate all three signals
    // (trick, error, hasSettled) — a refactor that short-circuits on error
    // before parsing the row would silently drop the trick.
    const queryError = new Error("partial failure");
    mockUseQuery.mockReturnValue({
      data: [sampleRow],
      isLoading: false,
      isFetching: false,
      error: queryError,
    });

    const { result } = renderHook(() => useTrick(trickId("trick-abc")));

    expect(result.current.trick).not.toBeNull();
    expect(result.current.trick?.id).toBe("trick-abc");
    expect(result.current.error).toBe(queryError);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasSettled).toBe(true);
  });

  // ---------------------------------------------------------------------
  // hasSettled — data-identity cross-check (defense against stale-row latch)
  // ---------------------------------------------------------------------

  it("does not latch hasSettled and returns trick=null when data still holds a different id (PowerSync stale-flag race)", () => {
    // On the first render after an id change, PowerSync's useWatchedQuery can
    // briefly report !isLoading && !isFetching while `data` still contains
    // the previous query's row. Both guards must fire together: the latch
    // stays unlatched (hasSettled=false) AND the returned `trick` is null
    // rather than the stale row — keeps the two signals on the same trust
    // boundary so a future caller can rely on "hasSettled=true implies trick
    // is the value for id".
    mockUseQuery.mockReturnValue({
      data: [{ ...sampleRow, id: "trick-stale" }],
      isLoading: false,
      isFetching: false,
      error: null,
    });

    const { result } = renderHook(() => useTrick(trickId("trick-target")));

    expect(result.current.hasSettled).toBe(false);
    expect(result.current.trick).toBeNull();
  });

  it("latches hasSettled when data is empty (settled-missing is a valid settle)", () => {
    // The empty-data branch of the data-identity guard: a settled-missing
    // row (deleted on another device) must still latch hasSettled so the
    // close+toast effect in repertoire-view can fire.
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: null,
    });
    const { result } = renderHook(() => useTrick(trickId("trick-abc")));

    expect(result.current.hasSettled).toBe(true);
  });
});
