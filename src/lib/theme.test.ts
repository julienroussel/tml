import { describe, expect, it } from "vitest";
import { isTheme, themes } from "./theme";

describe("themes", () => {
  it("contains exactly light, dark, and system", () => {
    expect(themes).toEqual(["light", "dark", "system"]);
    expect(themes).toHaveLength(3);
  });
});

describe("isTheme", () => {
  it.each(["light", "dark", "system"])("returns true for '%s'", (value) => {
    expect(isTheme(value)).toBe(true);
  });

  it.each([
    "",
    "auto",
    "sepia",
    "LIGHT",
    "Dark",
    "SYSTEM",
  ])("returns false for '%s'", (value) => {
    expect(isTheme(value)).toBe(false);
  });
});
