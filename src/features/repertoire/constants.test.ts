import { describe, expect, it } from "vitest";
import {
  ANGLE_SENSITIVITIES,
  DIFFICULTY_LABELS,
  PERFORMANCE_TYPES,
  STATUS_CONFIG,
  SUGGESTED_CATEGORIES,
  SUGGESTED_EFFECT_TYPES,
  TRICK_STATUSES,
} from "./constants";

describe("STATUS_CONFIG", () => {
  it("has an entry for every TRICK_STATUS", () => {
    for (const status of TRICK_STATUSES) {
      expect(STATUS_CONFIG).toHaveProperty(status);
    }
  });

  it("has no extra entries beyond TRICK_STATUSES", () => {
    expect(Object.keys(STATUS_CONFIG)).toHaveLength(TRICK_STATUSES.length);
  });

  it("every entry has a label string and a valid variant", () => {
    const validVariants = ["default", "secondary", "destructive", "outline"];
    for (const status of TRICK_STATUSES) {
      const config = STATUS_CONFIG[status];
      expect(typeof config.label).toBe("string");
      expect(config.label.length).toBeGreaterThan(0);
      expect(validVariants).toContain(config.variant);
    }
  });
});

describe("ANGLE_SENSITIVITIES", () => {
  it("contains none", () => {
    expect(ANGLE_SENSITIVITIES).toContain("none");
  });

  it("contains slight", () => {
    expect(ANGLE_SENSITIVITIES).toContain("slight");
  });

  it("contains moderate", () => {
    expect(ANGLE_SENSITIVITIES).toContain("moderate");
  });

  it("contains high", () => {
    expect(ANGLE_SENSITIVITIES).toContain("high");
  });

  it("has exactly 4 entries", () => {
    expect(ANGLE_SENSITIVITIES).toHaveLength(4);
  });
});

describe("PERFORMANCE_TYPES", () => {
  it("contains close_up", () => {
    expect(PERFORMANCE_TYPES).toContain("close_up");
  });

  it("contains parlor", () => {
    expect(PERFORMANCE_TYPES).toContain("parlor");
  });

  it("contains stage", () => {
    expect(PERFORMANCE_TYPES).toContain("stage");
  });

  it("contains street", () => {
    expect(PERFORMANCE_TYPES).toContain("street");
  });

  it("contains virtual", () => {
    expect(PERFORMANCE_TYPES).toContain("virtual");
  });
});

describe("SUGGESTED_CATEGORIES", () => {
  it("is non-empty", () => {
    expect(SUGGESTED_CATEGORIES.length).toBeGreaterThan(0);
  });

  it("contains common magic categories", () => {
    expect(SUGGESTED_CATEGORIES).toContain("Card");
    expect(SUGGESTED_CATEGORIES).toContain("Coin");
    expect(SUGGESTED_CATEGORIES).toContain("Mentalism");
  });
});

describe("SUGGESTED_EFFECT_TYPES", () => {
  it("is non-empty", () => {
    expect(SUGGESTED_EFFECT_TYPES.length).toBeGreaterThan(0);
  });

  it("contains common effect types", () => {
    expect(SUGGESTED_EFFECT_TYPES).toContain("Vanish");
    expect(SUGGESTED_EFFECT_TYPES).toContain("Prediction");
    expect(SUGGESTED_EFFECT_TYPES).toContain("Levitation");
  });
});

describe("DIFFICULTY_LABELS", () => {
  it("has exactly 5 entries", () => {
    expect(DIFFICULTY_LABELS).toHaveLength(5);
  });

  it("entries cover beginner through expert", () => {
    expect(DIFFICULTY_LABELS[0]).toBe("Beginner");
    expect(DIFFICULTY_LABELS[4]).toBe("Expert");
  });

  it("entries are in ascending difficulty order", () => {
    expect(DIFFICULTY_LABELS[0]).toBe("Beginner");
    expect(DIFFICULTY_LABELS[1]).toBe("Easy");
    expect(DIFFICULTY_LABELS[2]).toBe("Intermediate");
    expect(DIFFICULTY_LABELS[3]).toBe("Advanced");
    expect(DIFFICULTY_LABELS[4]).toBe("Expert");
  });
});
