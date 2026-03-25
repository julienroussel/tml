import { describe, expect, it } from "vitest";
import { locales } from "./config";
import { LOCALE_LABELS } from "./locale-labels";

describe("LOCALE_LABELS", () => {
  it("has a label for every supported locale", () => {
    for (const locale of locales) {
      expect(LOCALE_LABELS[locale]).toBeDefined();
      expect(LOCALE_LABELS[locale].length).toBeGreaterThan(0);
    }
  });

  it("covers exactly the supported locales", () => {
    const labelKeys = Object.keys(LOCALE_LABELS).sort();
    const supported = [...locales].sort();
    expect(labelKeys).toEqual(supported);
  });
});
