import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";

describe("sitemap", () => {
  it("returns entries for all locales and public routes (7 × 3 = 21)", () => {
    const result = sitemap();
    expect(result).toHaveLength(21);
  });

  it("uses locale-prefixed URLs for the homepage", () => {
    const result = sitemap();
    const enHome = result.find((e) => e.url === "https://themagiclab.app/en");
    expect(enHome).toBeDefined();
    const frHome = result.find((e) => e.url === "https://themagiclab.app/fr");
    expect(frHome).toBeDefined();
  });

  it("homepage has priority 1 and weekly frequency", () => {
    const result = sitemap();
    const homepage = result.find((e) => e.url === "https://themagiclab.app/en");
    expect(homepage?.priority).toBe(1);
    expect(homepage?.changeFrequency).toBe("weekly");
  });

  it("includes privacy and FAQ pages for all locales", () => {
    const result = sitemap();
    const urls = result.map((e) => e.url);
    expect(urls).toContain("https://themagiclab.app/en/privacy");
    expect(urls).toContain("https://themagiclab.app/en/faq");
    expect(urls).toContain("https://themagiclab.app/fr/privacy");
    expect(urls).toContain("https://themagiclab.app/fr/faq");
  });

  it("sets lastModified to Date instances", () => {
    const result = sitemap();
    for (const entry of result) {
      expect(entry.lastModified).toBeInstanceOf(Date);
    }
  });
});
