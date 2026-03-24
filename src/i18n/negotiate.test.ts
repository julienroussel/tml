import { describe, expect, it, vi } from "vitest";

vi.mock("./config", () => ({
  locales: ["en", "fr", "es", "pt", "it", "de", "nl"] as const,
  defaultLocale: "en",
  isLocale: (value: string) =>
    ["en", "fr", "es", "pt", "it", "de", "nl"].includes(value),
}));

describe("negotiateLocale", () => {
  it("picks exact match with highest q-value", async () => {
    const { negotiateLocale } = await import("./negotiate");
    expect(negotiateLocale("de,en;q=0.5")).toBe("de");
  });

  it("picks base language from regional tag", async () => {
    const { negotiateLocale } = await import("./negotiate");
    expect(negotiateLocale("es-MX")).toBe("es");
  });

  it("respects q-value ordering", async () => {
    const { negotiateLocale } = await import("./negotiate");
    expect(negotiateLocale("ja;q=1,it;q=0.9,en;q=0.8")).toBe("it");
  });

  it("returns undefined for unsupported languages", async () => {
    const { negotiateLocale } = await import("./negotiate");
    expect(negotiateLocale("ja,zh,ko")).toBeUndefined();
  });

  it("handles empty string", async () => {
    const { negotiateLocale } = await import("./negotiate");
    expect(negotiateLocale("")).toBeUndefined();
  });

  it("skips entries with q=0", async () => {
    const { negotiateLocale } = await import("./negotiate");
    expect(negotiateLocale("fr;q=0,en;q=0.5")).toBe("en");
  });

  it("treats malformed q-value as q=0", async () => {
    const { negotiateLocale } = await import("./negotiate");
    expect(negotiateLocale("fr;q=abc,en;q=0.5")).toBe("en");
  });
});
