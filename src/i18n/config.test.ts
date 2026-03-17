import { describe, expect, it } from "vitest";
import { defaultLocale, locales } from "./config";

describe("i18n config", () => {
  it("contains all 7 expected locales", () => {
    expect(locales).toEqual(["en", "fr", "es", "pt", "it", "de", "nl"]);
    expect(locales).toHaveLength(7);
  });

  it("has 'en' as the default locale", () => {
    expect(defaultLocale).toBe("en");
  });

  it("includes 'en' in the locales array", () => {
    expect(locales).toContain("en");
  });
});
