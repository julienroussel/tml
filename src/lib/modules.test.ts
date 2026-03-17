import { describe, expect, it } from "vitest";
import type { ModuleSlug } from "./modules";
import {
  APP_MODULES,
  getAdminModules,
  getMainModules,
  getModule,
} from "./modules";

describe("modules registry", () => {
  it("contains all expected slugs", () => {
    const slugs = APP_MODULES.map((m) => m.slug);
    expect(slugs).toContain("improve");
    expect(slugs).toContain("train");
    expect(slugs).toContain("plan");
    expect(slugs).toContain("perform");
    expect(slugs).toContain("enhance");
    expect(slugs).toContain("collect");
    expect(slugs).toContain("admin");
    expect(slugs).toHaveLength(7);
  });

  it("main + admin modules equal total", () => {
    expect(getMainModules().length + getAdminModules().length).toBe(
      APP_MODULES.length
    );
  });

  it("every module has required fields", () => {
    for (const mod of APP_MODULES) {
      expect(mod.slug).toBeTruthy();
      expect(mod.label).toBeTruthy();
      expect(mod.description).toBeTruthy();
      expect(mod.icon).toBeDefined();
      expect(typeof mod.enabled).toBe("boolean");
      expect(["main", "admin"]).toContain(mod.group);
    }
  });

  it("module slugs are unique", () => {
    const slugs = APP_MODULES.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("module groups are valid values", () => {
    const validGroups = new Set(["main", "admin"]);
    for (const mod of APP_MODULES) {
      expect(validGroups.has(mod.group)).toBe(true);
    }
  });

  it("all modules are currently disabled", () => {
    for (const mod of APP_MODULES) {
      expect(mod.enabled).toBe(false);
    }
  });
});

describe("getModule", () => {
  it("returns the correct module by slug", () => {
    const mod = getModule("improve");
    expect(mod.slug).toBe("improve");
    expect(mod.label).toBe("Improve");
  });

  it("throws for an invalid slug", () => {
    expect(() => getModule("nonexistent" as ModuleSlug)).toThrow(
      "Module not found: nonexistent"
    );
  });
});

describe("getMainModules", () => {
  it("returns only main modules", () => {
    const mods = getMainModules();
    expect(mods.length).toBeGreaterThan(0);
    for (const mod of mods) {
      expect(mod.group).toBe("main");
    }
  });
});

describe("getAdminModules", () => {
  it("returns only admin modules", () => {
    const mods = getAdminModules();
    expect(mods.length).toBeGreaterThan(0);
    for (const mod of mods) {
      expect(mod.group).toBe("admin");
    }
  });
});
