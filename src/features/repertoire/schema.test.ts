import { describe, expect, it } from "vitest";
import { tagFormSchema, trickFormSchema } from "./schema";

describe("trickFormSchema", () => {
  describe("name field", () => {
    it("is valid with only name provided", () => {
      const result = trickFormSchema.safeParse({ name: "Card Warp" });
      expect(result.success).toBe(true);
    });

    it("is valid with all fields provided", () => {
      const result = trickFormSchema.safeParse({
        name: "Card Warp",
        description: "A visual card effect",
        category: "Card",
        effectType: "Transformation",
        difficulty: 3,
        status: "learning",
        duration: 120,
        performanceType: "close_up",
        angleSensitivity: "moderate",
        props: "Deck of cards",
        music: "Ambient",
        languages: ["en", "fr"],
        isCameraFriendly: true,
        isSilent: false,
        source: "Card College Vol. 3",
        videoUrl: "https://youtube.com/watch?v=abc123",
        notes: "Practice the bend slowly",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const result = trickFormSchema.safeParse({ name: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("validation.nameRequired");
      }
    });

    it("rejects whitespace-only name after trim", () => {
      const result = trickFormSchema.safeParse({ name: "   " });
      expect(result.success).toBe(false);
    });

    it("rejects name exceeding 200 characters", () => {
      const result = trickFormSchema.safeParse({ name: "a".repeat(201) });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("validation.nameTooLong");
      }
    });

    it("accepts name of exactly 200 characters", () => {
      const result = trickFormSchema.safeParse({ name: "a".repeat(200) });
      expect(result.success).toBe(true);
    });
  });

  describe("difficulty field", () => {
    it("accepts valid difficulty values 1 through 5", () => {
      for (const d of [1, 2, 3, 4, 5]) {
        const result = trickFormSchema.safeParse({
          name: "Trick",
          difficulty: d,
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects difficulty of 0", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        difficulty: 0,
      });
      expect(result.success).toBe(false);
    });

    it("rejects difficulty of 6", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        difficulty: 6,
      });
      expect(result.success).toBe(false);
    });

    it("coerces string difficulty to number", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        difficulty: "3",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.difficulty).toBe(3);
      }
    });

    it("defaults to null when not provided", () => {
      const result = trickFormSchema.safeParse({ name: "Trick" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.difficulty).toBeNull();
      }
    });
  });

  describe("status field", () => {
    it("accepts valid status values", () => {
      const validStatuses = [
        "new",
        "learning",
        "performance_ready",
        "mastered",
        "shelved",
      ];
      for (const status of validStatuses) {
        const result = trickFormSchema.safeParse({ name: "Trick", status });
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid status value", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        status: "archived",
      });
      expect(result.success).toBe(false);
    });

    it("defaults to new when not provided", () => {
      const result = trickFormSchema.safeParse({ name: "Trick" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("new");
      }
    });
  });

  describe("videoUrl field", () => {
    it("accepts a valid URL", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        videoUrl: "https://youtube.com/watch?v=abc",
      });
      expect(result.success).toBe(true);
    });

    it("accepts an empty string for videoUrl", () => {
      const result = trickFormSchema.safeParse({ name: "Trick", videoUrl: "" });
      expect(result.success).toBe(true);
    });

    it("rejects an invalid URL", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        videoUrl: "not-a-valid-url",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("validation.invalidUrl");
      }
    });

    it("defaults to empty string when not provided", () => {
      const result = trickFormSchema.safeParse({ name: "Trick" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.videoUrl).toBe("");
      }
    });
  });

  describe("description field boundaries", () => {
    it("accepts description at exactly 2000 characters", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        description: "a".repeat(2000),
      });
      expect(result.success).toBe(true);
    });

    it("rejects description at 2001 characters", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        description: "a".repeat(2001),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          "validation.descriptionTooLong"
        );
      }
    });
  });

  describe("duration field boundaries", () => {
    it("accepts duration of 0", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        duration: 0,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.duration).toBe(0);
      }
    });

    it("accepts duration of 7200", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        duration: 7200,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.duration).toBe(7200);
      }
    });

    it("rejects duration of 7201", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        duration: 7201,
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative duration", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        duration: -1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("notes field boundaries", () => {
    it("accepts notes at exactly 5000 characters", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        notes: "a".repeat(5000),
      });
      expect(result.success).toBe(true);
    });

    it("rejects notes at 5001 characters", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        notes: "a".repeat(5001),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("props field boundaries", () => {
    it("accepts props at exactly 1000 characters", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        props: "a".repeat(1000),
      });
      expect(result.success).toBe(true);
    });

    it("rejects props at 1001 characters", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        props: "a".repeat(1001),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("music field boundaries", () => {
    it("accepts music at exactly 200 characters", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        music: "a".repeat(200),
      });
      expect(result.success).toBe(true);
    });

    it("rejects music at 201 characters", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        music: "a".repeat(201),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("source field boundaries", () => {
    it("accepts source at exactly 500 characters", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        source: "a".repeat(500),
      });
      expect(result.success).toBe(true);
    });

    it("rejects source at 501 characters", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        source: "a".repeat(501),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("category field boundaries", () => {
    it("accepts category at exactly 100 characters", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        category: "a".repeat(100),
      });
      expect(result.success).toBe(true);
    });

    it("rejects category at 101 characters", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        category: "a".repeat(101),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("effectType field boundaries", () => {
    it("accepts effectType at exactly 100 characters", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        effectType: "a".repeat(100),
      });
      expect(result.success).toBe(true);
    });

    it("rejects effectType at 101 characters", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        effectType: "a".repeat(101),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("optional fields with coerced defaults", () => {
    it("coerces defaults for all optional fields when only name is given", () => {
      const result = trickFormSchema.safeParse({ name: "Trick" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe("");
        expect(result.data.category).toBe("");
        expect(result.data.effectType).toBe("");
        expect(result.data.difficulty).toBeNull();
        expect(result.data.duration).toBeNull();
        expect(result.data.performanceType).toBeNull();
        expect(result.data.angleSensitivity).toBeNull();
        expect(result.data.props).toBe("");
        expect(result.data.music).toBe("");
        expect(result.data.languages).toEqual([]);
        expect(result.data.isCameraFriendly).toBeNull();
        expect(result.data.isSilent).toBeNull();
        expect(result.data.source).toBe("");
        expect(result.data.notes).toBe("");
      }
    });

    it("coerces string duration to number", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        duration: "90",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.duration).toBe(90);
      }
    });
  });

  describe("languages field", () => {
    it("accepts an array of strings", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        languages: ["English", "French"],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.languages).toEqual(["English", "French"]);
      }
    });

    it("accepts an empty array", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        languages: [],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.languages).toEqual([]);
      }
    });

    it("accepts exactly 10 languages", () => {
      const languages = Array.from({ length: 10 }, (_, i) => `Lang ${i}`);
      const result = trickFormSchema.safeParse({ name: "Trick", languages });
      expect(result.success).toBe(true);
    });

    it("rejects more than 10 languages", () => {
      const languages = Array.from({ length: 11 }, (_, i) => `Lang ${i}`);
      const result = trickFormSchema.safeParse({ name: "Trick", languages });
      expect(result.success).toBe(false);
    });

    it("rejects a language string exceeding 50 characters", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        languages: ["a".repeat(51)],
      });
      expect(result.success).toBe(false);
    });

    it("accepts a language string of exactly 50 characters", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        languages: ["a".repeat(50)],
      });
      expect(result.success).toBe(true);
    });

    it("defaults to empty array when not provided", () => {
      const result = trickFormSchema.safeParse({ name: "Trick" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.languages).toEqual([]);
      }
    });
  });

  describe("performanceType field", () => {
    it("accepts valid performance types", () => {
      const validTypes = ["close_up", "parlor", "stage", "street", "virtual"];
      for (const performanceType of validTypes) {
        const result = trickFormSchema.safeParse({
          name: "Trick",
          performanceType,
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid performance type", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        performanceType: "outdoor",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("angleSensitivity field", () => {
    it("accepts valid angle sensitivity values", () => {
      const validValues = ["none", "slight", "moderate", "high"];
      for (const angleSensitivity of validValues) {
        const result = trickFormSchema.safeParse({
          name: "Trick",
          angleSensitivity,
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid angle sensitivity value", () => {
      const result = trickFormSchema.safeParse({
        name: "Trick",
        angleSensitivity: "extreme",
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("tagFormSchema", () => {
  it("is valid with a name", () => {
    const result = tagFormSchema.safeParse({ name: "Opener" });
    expect(result.success).toBe(true);
  });

  it("is valid with a name and hex color", () => {
    const result = tagFormSchema.safeParse({
      name: "Opener",
      color: "#ff5733",
    });
    expect(result.success).toBe(true);
  });

  it("is valid with uppercase hex color", () => {
    const result = tagFormSchema.safeParse({
      name: "Opener",
      color: "#FF5733",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = tagFormSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "validation.tagNameRequired"
      );
    }
  });

  it("rejects name exceeding 50 characters", () => {
    const result = tagFormSchema.safeParse({ name: "a".repeat(51) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("validation.tagNameTooLong");
    }
  });

  it("accepts name of exactly 50 characters", () => {
    const result = tagFormSchema.safeParse({ name: "a".repeat(50) });
    expect(result.success).toBe(true);
  });

  it("rejects invalid color format — no hash prefix", () => {
    const result = tagFormSchema.safeParse({ name: "Tag", color: "ff5733" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid color format — 3-digit shorthand", () => {
    const result = tagFormSchema.safeParse({ name: "Tag", color: "#fff" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid color format — non-hex characters", () => {
    const result = tagFormSchema.safeParse({ name: "Tag", color: "#zzzzzz" });
    expect(result.success).toBe(false);
  });

  it("defaults color to null when not provided", () => {
    const result = tagFormSchema.safeParse({ name: "Tag" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.color).toBeNull();
    }
  });
});
