import { describe, expect, it } from "vitest";
import type { TrickRow } from "./parse-trick";
import { intToBoolean, parseLanguages, parseTrickRow } from "./parse-trick";

describe("parseLanguages", () => {
  it("parses a valid JSON array of strings", () => {
    expect(parseLanguages('["en","fr","es"]')).toEqual(["en", "fr", "es"]);
  });

  it("returns empty array for null input", () => {
    expect(parseLanguages(null)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseLanguages("")).toEqual([]);
  });

  it("returns empty array for malformed JSON", () => {
    expect(parseLanguages("{not valid json")).toEqual([]);
  });

  it("returns empty array for non-array JSON", () => {
    expect(parseLanguages('{"key":"value"}')).toEqual([]);
  });

  it("returns empty array for JSON number", () => {
    expect(parseLanguages("42")).toEqual([]);
  });

  it("returns empty array for JSON string", () => {
    expect(parseLanguages('"just a string"')).toEqual([]);
  });

  it("filters out non-string elements from array", () => {
    expect(parseLanguages('[1, "en", null, "fr", true]')).toEqual(["en", "fr"]);
  });

  it("returns empty array for JSON array of non-strings", () => {
    expect(parseLanguages("[1, 2, 3]")).toEqual([]);
  });

  it("handles single-element array", () => {
    expect(parseLanguages('["en"]')).toEqual(["en"]);
  });

  it("handles empty JSON array", () => {
    expect(parseLanguages("[]")).toEqual([]);
  });
});

describe("intToBoolean", () => {
  it("converts 1 to true", () => {
    expect(intToBoolean(1)).toBe(true);
  });

  it("converts 0 to false", () => {
    expect(intToBoolean(0)).toBe(false);
  });

  it("converts null to null", () => {
    expect(intToBoolean(null)).toBeNull();
  });

  it("converts non-zero positive to true", () => {
    expect(intToBoolean(5)).toBe(true);
  });

  it("converts negative number to true", () => {
    expect(intToBoolean(-1)).toBe(true);
  });
});

describe("parseTrickRow", () => {
  function createMinimalRow(overrides?: Partial<TrickRow>): TrickRow {
    return {
      id: "trick-1",
      name: "Ambitious Card",
      description: "A classic effect",
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
      notes: "Practice bend",
      source: "Card College",
      video_url: "https://example.com",
      created_at: "2025-01-15T12:00:00.000Z",
      updated_at: "2025-01-15T13:00:00.000Z",
      ...overrides,
    };
  }

  it("maps snake_case to camelCase fields", () => {
    const result = parseTrickRow(createMinimalRow());

    expect(result.effectType).toBe("Transformation");
    expect(result.performanceType).toBe("close_up");
    expect(result.angleSensitivity).toBe("moderate");
    expect(result.isCameraFriendly).toBe(true);
    expect(result.isSilent).toBe(false);
    expect(result.videoUrl).toBe("https://example.com");
    expect(result.createdAt).toBe("2025-01-15T12:00:00.000Z");
    expect(result.updatedAt).toBe("2025-01-15T13:00:00.000Z");
  });

  it("parses languages from JSON string", () => {
    const result = parseTrickRow(createMinimalRow());
    expect(result.languages).toEqual(["en", "fr"]);
  });

  it("converts integer booleans to JS booleans", () => {
    const result = parseTrickRow(
      createMinimalRow({ is_camera_friendly: 0, is_silent: 1 })
    );
    expect(result.isCameraFriendly).toBe(false);
    expect(result.isSilent).toBe(true);
  });

  it("handles null boolean fields", () => {
    const result = parseTrickRow(
      createMinimalRow({ is_camera_friendly: null, is_silent: null })
    );
    expect(result.isCameraFriendly).toBeNull();
    expect(result.isSilent).toBeNull();
  });

  it("handles null languages", () => {
    const result = parseTrickRow(createMinimalRow({ languages: null }));
    expect(result.languages).toEqual([]);
  });

  it("preserves all scalar fields", () => {
    const result = parseTrickRow(createMinimalRow());

    expect(result.id).toBe("trick-1");
    expect(result.name).toBe("Ambitious Card");
    expect(result.description).toBe("A classic effect");
    expect(result.category).toBe("Card");
    expect(result.difficulty).toBe(3);
    expect(result.status).toBe("learning");
    expect(result.duration).toBe(120);
    expect(result.props).toBe("Deck of cards");
    expect(result.music).toBeNull();
    expect(result.notes).toBe("Practice bend");
    expect(result.source).toBe("Card College");
  });

  it("falls back to null for unknown performance type", () => {
    const result = parseTrickRow(
      createMinimalRow({ performance_type: "underwater" })
    );
    expect(result.performanceType).toBeNull();
  });

  it("falls back to null for unknown angle sensitivity", () => {
    const result = parseTrickRow(
      createMinimalRow({ angle_sensitivity: "extreme" })
    );
    expect(result.angleSensitivity).toBeNull();
  });

  it("falls back to 'new' for unknown status", () => {
    const result = parseTrickRow(createMinimalRow({ status: "archived" }));
    expect(result.status).toBe("new");
  });

  it("handles fully null optional fields", () => {
    const result = parseTrickRow(
      createMinimalRow({
        description: null,
        category: null,
        effect_type: null,
        difficulty: null,
        duration: null,
        performance_type: null,
        angle_sensitivity: null,
        props: null,
        music: null,
        notes: null,
        source: null,
        video_url: null,
      })
    );

    expect(result.description).toBeNull();
    expect(result.category).toBeNull();
    expect(result.effectType).toBeNull();
    expect(result.difficulty).toBeNull();
    expect(result.duration).toBeNull();
    expect(result.performanceType).toBeNull();
    expect(result.angleSensitivity).toBeNull();
    expect(result.props).toBeNull();
    expect(result.music).toBeNull();
    expect(result.notes).toBeNull();
    expect(result.source).toBeNull();
    expect(result.videoUrl).toBeNull();
  });
});
