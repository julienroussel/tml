import { describe, expect, it } from "vitest";
import {
  CONDITION_CONFIG,
  ITEM_CONDITIONS,
  ITEM_TYPES,
  MAX_TAGS_PER_ITEM,
  MAX_TRICKS_PER_ITEM,
  SUGGESTED_BRANDS,
  SUGGESTED_LOCATIONS,
  TYPE_CONFIG,
} from "./constants";

const TYPE_LABEL_RE = /^type\./;
const CONDITION_LABEL_RE = /^condition\./;

describe("TYPE_CONFIG", () => {
  it("has an entry for every ITEM_TYPE", () => {
    for (const type of ITEM_TYPES) {
      expect(TYPE_CONFIG).toHaveProperty(type);
    }
  });

  it("has no extra entries beyond ITEM_TYPES", () => {
    expect(Object.keys(TYPE_CONFIG)).toHaveLength(ITEM_TYPES.length);
  });

  it("every entry has a label string and a valid variant", () => {
    const validVariants = ["default", "secondary", "destructive", "outline"];
    for (const type of ITEM_TYPES) {
      const config = TYPE_CONFIG[type];
      expect(typeof config.label).toBe("string");
      expect(config.label.length).toBeGreaterThan(0);
      expect(validVariants).toContain(config.variant);
    }
  });

  it("labels are namespaced with type. prefix", () => {
    for (const type of ITEM_TYPES) {
      expect(TYPE_CONFIG[type].label).toMatch(TYPE_LABEL_RE);
    }
  });
});

describe("CONDITION_CONFIG", () => {
  it("has an entry for every ITEM_CONDITION", () => {
    for (const condition of ITEM_CONDITIONS) {
      expect(CONDITION_CONFIG).toHaveProperty(condition);
    }
  });

  it("has no extra entries beyond ITEM_CONDITIONS", () => {
    expect(Object.keys(CONDITION_CONFIG)).toHaveLength(ITEM_CONDITIONS.length);
  });

  it("every entry has a label string and a valid variant", () => {
    const validVariants = ["default", "secondary", "destructive", "outline"];
    for (const condition of ITEM_CONDITIONS) {
      const config = CONDITION_CONFIG[condition];
      expect(typeof config.label).toBe("string");
      expect(config.label.length).toBeGreaterThan(0);
      expect(validVariants).toContain(config.variant);
    }
  });

  it("labels are namespaced with condition. prefix", () => {
    for (const condition of ITEM_CONDITIONS) {
      expect(CONDITION_CONFIG[condition].label).toMatch(CONDITION_LABEL_RE);
    }
  });
});

describe("ITEM_TYPES", () => {
  it("contains all expected item types", () => {
    expect(ITEM_TYPES).toContain("prop");
    expect(ITEM_TYPES).toContain("book");
    expect(ITEM_TYPES).toContain("gimmick");
    expect(ITEM_TYPES).toContain("dvd");
    expect(ITEM_TYPES).toContain("download");
    expect(ITEM_TYPES).toContain("deck");
    expect(ITEM_TYPES).toContain("clothing");
    expect(ITEM_TYPES).toContain("consumable");
    expect(ITEM_TYPES).toContain("accessory");
    expect(ITEM_TYPES).toContain("other");
  });

  it("has exactly 10 entries", () => {
    expect(ITEM_TYPES).toHaveLength(10);
  });

  it("has unique values", () => {
    const unique = new Set(ITEM_TYPES);
    expect(unique.size).toBe(ITEM_TYPES.length);
  });
});

describe("ITEM_CONDITIONS", () => {
  it("contains all expected condition values", () => {
    expect(ITEM_CONDITIONS).toContain("new");
    expect(ITEM_CONDITIONS).toContain("good");
    expect(ITEM_CONDITIONS).toContain("worn");
    expect(ITEM_CONDITIONS).toContain("needs_repair");
  });

  it("has exactly 4 entries", () => {
    expect(ITEM_CONDITIONS).toHaveLength(4);
  });

  it("has unique values", () => {
    const unique = new Set(ITEM_CONDITIONS);
    expect(unique.size).toBe(ITEM_CONDITIONS.length);
  });
});

describe("SUGGESTED_BRANDS", () => {
  it("is non-empty", () => {
    expect(SUGGESTED_BRANDS.length).toBeGreaterThan(0);
  });

  it("contains well-known magic brands", () => {
    expect(SUGGESTED_BRANDS).toContain("Bicycle");
    expect(SUGGESTED_BRANDS).toContain("Theory11");
    expect(SUGGESTED_BRANDS).toContain("Ellusionist");
  });

  it("has unique values", () => {
    const unique = new Set(SUGGESTED_BRANDS);
    expect(unique.size).toBe(SUGGESTED_BRANDS.length);
  });
});

describe("SUGGESTED_LOCATIONS", () => {
  it("is non-empty", () => {
    expect(SUGGESTED_LOCATIONS.length).toBeGreaterThan(0);
  });

  it("contains common storage locations", () => {
    expect(SUGGESTED_LOCATIONS).toContain("Close-up case");
    expect(SUGGESTED_LOCATIONS).toContain("Stage case");
  });

  it("has unique values", () => {
    const unique = new Set(SUGGESTED_LOCATIONS);
    expect(unique.size).toBe(SUGGESTED_LOCATIONS.length);
  });
});

describe("MAX_TAGS_PER_ITEM", () => {
  it("is a positive integer", () => {
    expect(typeof MAX_TAGS_PER_ITEM).toBe("number");
    expect(MAX_TAGS_PER_ITEM).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_TAGS_PER_ITEM)).toBe(true);
  });

  it("is 20", () => {
    expect(MAX_TAGS_PER_ITEM).toBe(20);
  });
});

describe("MAX_TRICKS_PER_ITEM", () => {
  it("is a positive integer", () => {
    expect(typeof MAX_TRICKS_PER_ITEM).toBe("number");
    expect(MAX_TRICKS_PER_ITEM).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_TRICKS_PER_ITEM)).toBe(true);
  });

  it("is 50", () => {
    expect(MAX_TRICKS_PER_ITEM).toBe(50);
  });
});
