import { describe, expect, it, vi } from "vitest";
import type { TrickId } from "@/db/types";
import type { TrickRow } from "./parse-trick";

// --- Mocks -----------------------------------------------------------

const mockUseQuery = vi.fn();

vi.mock("@powersync/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

// useTrick takes a branded TrickId; cast string fixtures at the call site.
const trickId = (id: string) => id as TrickId;

// --- Test suite -------------------------------------------------------

describe("useTrick", () => {
  function getHook() {
    return import("./use-trick");
  }

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

  it("returns null trick and isLoading false when id is null", async () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });

    const { useTrick } = await getHook();
    const result = useTrick(null);

    expect(result).toEqual({ trick: null, isLoading: false, error: null });
    expect(mockUseQuery).toHaveBeenCalledWith("SELECT 1 WHERE 0", []);
  });

  it("forces isLoading false on the null-id early return even when the disabled query reports loading", async () => {
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

    const { useTrick } = await getHook();
    const result = useTrick(null);

    expect(result.isLoading).toBe(false);
    expect(result.trick).toBeNull();
    expect(result.error).toBeNull();
  });

  it("returns parsed trick when id matches a row", async () => {
    mockUseQuery.mockReturnValue({
      data: [sampleRow],
      isLoading: false,
      isFetching: false,
    });

    const { useTrick } = await getHook();
    const result = useTrick(trickId("trick-abc"));

    expect(mockUseQuery).toHaveBeenCalledWith(
      "SELECT * FROM tricks WHERE id = ? AND deleted_at IS NULL",
      ["trick-abc"]
    );
    expect(result.isLoading).toBe(false);
    expect(result.trick).not.toBeNull();
    expect(result.trick?.id).toBe("trick-abc");
    expect(result.trick?.name).toBe("Ambitious Card");
    expect(result.trick?.status).toBe("learning");
    expect(result.trick?.isCameraFriendly).toBe(true);
    expect(result.trick?.isSilent).toBe(false);
    expect(result.trick?.languages).toEqual(["en", "fr"]);
  });

  it("returns null trick when id has no matching data", async () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
    });

    const { useTrick } = await getHook();
    const result = useTrick(trickId("nonexistent-id"));

    expect(mockUseQuery).toHaveBeenCalledWith(
      "SELECT * FROM tricks WHERE id = ? AND deleted_at IS NULL",
      ["nonexistent-id"]
    );
    expect(result).toEqual({ trick: null, isLoading: false, error: null });
  });

  it("surfaces error from useQuery when query fails", async () => {
    const queryError = new Error("SQLite I/O failure");
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: queryError,
    });

    const { useTrick } = await getHook();
    const result = useTrick(trickId("trick-abc"));

    // Lock the full shape — a regression that propagates `error` but flips
    // `isLoading` to true (stalling the UI) would not fail a property-only
    // assertion but does fail this structural lock.
    expect(result).toEqual({
      trick: null,
      isLoading: false,
      error: queryError,
    });
  });

  it("passes through isLoading from useQuery when id is provided", async () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: true,
      isFetching: false,
      error: null,
    });

    const { useTrick } = await getHook();
    const result = useTrick(trickId("trick-abc"));

    expect(result.isLoading).toBe(true);
    expect(result.trick).toBeNull();
  });

  it("folds isFetching into isLoading so a query-param change still reports loading", async () => {
    // PowerSync's useWatchedQuery reports the previous query's isLoading
    // (false) on the first render after the id changes; isFetching covers it.
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: true,
    });

    const { useTrick } = await getHook();
    const result = useTrick(trickId("trick-abc"));

    expect(result.isLoading).toBe(true);
  });

  it("reports isLoading false once the query is fully settled", async () => {
    // Locks the non-loading branch of the isFetching fold: both isLoading
    // and isFetching false must yield isLoading false.
    mockUseQuery.mockReturnValue({
      data: [sampleRow],
      isLoading: false,
      isFetching: false,
    });

    const { useTrick } = await getHook();
    const result = useTrick(trickId("trick-abc"));

    expect(result.isLoading).toBe(false);
  });
});
