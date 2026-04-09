import { describe, expect, it } from "vitest";
import type { ModuleSlug } from "./modules";
import {
  APP_MODULES,
  getModule,
  getModulesByGroup,
  MODULE_GROUP_NAV_KEYS,
  MODULE_GROUPS,
} from "./modules";

describe("modules registry", () => {
  it("contains all expected slugs", () => {
    const slugs = APP_MODULES.map((m) => m.slug);
    expect(slugs).toContain("repertoire");
    expect(slugs).toContain("collect");
    expect(slugs).toContain("improve");
    expect(slugs).toContain("train");
    expect(slugs).toContain("plan");
    expect(slugs).toContain("perform");
    expect(slugs).toContain("enhance");
    expect(slugs).toContain("admin");
    expect(slugs).toHaveLength(8);
  });

  it("groups combined equal total module count", () => {
    const totalFromGroups = MODULE_GROUPS.reduce(
      (sum, g) => sum + getModulesByGroup(g).length,
      0
    );
    expect(totalFromGroups).toBe(APP_MODULES.length);
  });

  it("every module has required fields", () => {
    const validGroups = new Set(["library", "lab", "insights", "admin"]);
    for (const mod of APP_MODULES) {
      expect(mod.slug).toBeTruthy();
      expect(mod.icon).toBeDefined();
      expect(typeof mod.enabled).toBe("boolean");
      expect(validGroups.has(mod.group)).toBe(true);
    }
  });

  it("module slugs are unique", () => {
    const slugs = APP_MODULES.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("repertoire is enabled", () => {
    expect(getModule("repertoire").enabled).toBe(true);
  });
});

describe("getModule", () => {
  it("returns the correct module by slug", () => {
    const mod = getModule("improve");
    expect(mod.slug).toBe("improve");
  });

  it("throws for an invalid slug", () => {
    expect(() => getModule("nonexistent" as ModuleSlug)).toThrow(
      "Module not found: nonexistent"
    );
  });
});

describe("MODULE_GROUP_NAV_KEYS", () => {
  it("has a key for every entry in MODULE_GROUPS", () => {
    for (const group of MODULE_GROUPS) {
      expect(MODULE_GROUP_NAV_KEYS).toHaveProperty(group);
    }
  });

  it("every value is a non-empty string", () => {
    for (const value of Object.values(MODULE_GROUP_NAV_KEYS)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

describe("getModulesByGroup", () => {
  it("returns only modules of the requested group", () => {
    for (const group of MODULE_GROUPS) {
      const mods = getModulesByGroup(group);
      const expected = APP_MODULES.filter((m) => m.group === group);
      expect(mods).toHaveLength(expected.length);
      for (const mod of mods) {
        expect(mod.group).toBe(group);
      }
    }
  });
});
