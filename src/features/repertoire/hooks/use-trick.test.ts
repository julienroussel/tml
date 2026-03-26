import { describe, expect, it, vi } from "vitest";
import type { TrickRow } from "./parse-trick";

// --- Mocks -----------------------------------------------------------

const mockUseQuery = vi.fn();

vi.mock("@powersync/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

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

    expect(result).toEqual({ trick: null, isLoading: false });
    expect(mockUseQuery).toHaveBeenCalledWith("SELECT 1 WHERE 0", []);
  });

  it("returns parsed trick when id matches a row", async () => {
    mockUseQuery.mockReturnValue({ data: [sampleRow], isLoading: false });

    const { useTrick } = await getHook();
    const result = useTrick("trick-abc");

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
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });

    const { useTrick } = await getHook();
    const result = useTrick("nonexistent-id");

    expect(mockUseQuery).toHaveBeenCalledWith(
      "SELECT * FROM tricks WHERE id = ? AND deleted_at IS NULL",
      ["nonexistent-id"]
    );
    expect(result).toEqual({ trick: null, isLoading: false });
  });

  it("passes through isLoading from useQuery when id is provided", async () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: true });

    const { useTrick } = await getHook();
    const result = useTrick("trick-abc");

    expect(result.isLoading).toBe(true);
    expect(result.trick).toBeNull();
  });
});
