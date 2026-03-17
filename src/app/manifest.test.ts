import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("manifest", () => {
  it("returns correct app name", () => {
    const m = manifest();
    expect(m.name).toBe("The Magic Lab");
    expect(m.short_name).toBe("Magic Lab");
  });

  it("uses standalone display mode", () => {
    expect(manifest().display).toBe("standalone");
  });

  it("starts from dashboard URL", () => {
    expect(manifest().start_url).toBe("/dashboard");
  });

  it("includes shortcuts", () => {
    const m = manifest();
    expect(m.shortcuts).toBeDefined();
    expect(m.shortcuts).toHaveLength(2);
  });

  it("includes categories", () => {
    const m = manifest();
    expect(m.categories).toContain("productivity");
  });

  it("includes required icon sizes", () => {
    const icons = manifest().icons;
    expect(icons).toBeDefined();
    expect(icons).toHaveLength(3);
    expect(icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "192x192" }),
        expect.objectContaining({ sizes: "512x512" }),
        expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
      ])
    );
  });
});
