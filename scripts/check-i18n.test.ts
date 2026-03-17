import { describe, expect, it } from "vitest";
import { compareLocale, getNestedKeys } from "./check-i18n";

describe("getNestedKeys", () => {
  it("extracts flat keys", () => {
    const obj = { a: "1", b: "2", c: "3" };
    expect(getNestedKeys(obj)).toEqual(["a", "b", "c"]);
  });

  it("extracts nested keys with dot notation", () => {
    const obj = {
      common: { save: "Save", cancel: "Cancel" },
      nav: { dashboard: "Dashboard" },
    };
    expect(getNestedKeys(obj)).toEqual([
      "common.save",
      "common.cancel",
      "nav.dashboard",
    ]);
  });

  it("handles deeply nested objects", () => {
    const obj = { a: { b: { c: "deep" } } };
    expect(getNestedKeys(obj)).toEqual(["a.b.c"]);
  });
});

describe("compareLocale", () => {
  it("returns no errors when keys match exactly", () => {
    const refKeys = ["common.save", "common.cancel", "nav.dashboard"];
    const localeKeys = ["common.save", "common.cancel", "nav.dashboard"];

    const result = compareLocale(refKeys, localeKeys, "fr");

    expect(result.locale).toBe("fr");
    expect(result.missingKeys).toEqual([]);
    expect(result.extraKeys).toEqual([]);
  });

  it("reports missing keys", () => {
    const refKeys = ["common.save", "common.cancel", "nav.dashboard"];
    const localeKeys = ["common.save"];

    const result = compareLocale(refKeys, localeKeys, "es");

    expect(result.locale).toBe("es");
    expect(result.missingKeys).toEqual(["common.cancel", "nav.dashboard"]);
    expect(result.extraKeys).toEqual([]);
  });

  it("reports extra keys", () => {
    const refKeys = ["common.save"];
    const localeKeys = ["common.save", "common.extra", "nav.bonus"];

    const result = compareLocale(refKeys, localeKeys, "de");

    expect(result.locale).toBe("de");
    expect(result.missingKeys).toEqual([]);
    expect(result.extraKeys).toEqual(["common.extra", "nav.bonus"]);
  });

  it("reports both missing and extra keys simultaneously", () => {
    const refKeys = ["common.save", "common.cancel"];
    const localeKeys = ["common.save", "common.extra"];

    const result = compareLocale(refKeys, localeKeys, "nl");

    expect(result.locale).toBe("nl");
    expect(result.missingKeys).toEqual(["common.cancel"]);
    expect(result.extraKeys).toEqual(["common.extra"]);
  });

  it("compares nested keys correctly", () => {
    const refKeys = ["a.b.c", "a.b.d", "x.y"];
    const localeKeys = ["a.b.c", "x.y"];

    const result = compareLocale(refKeys, localeKeys, "pt");

    expect(result.locale).toBe("pt");
    expect(result.missingKeys).toEqual(["a.b.d"]);
    expect(result.extraKeys).toEqual([]);
  });
});
