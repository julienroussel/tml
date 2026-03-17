import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";

describe("sitemap", () => {
  it("returns entries for all public routes", () => {
    const result = sitemap();
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it("uses the correct production URL for homepage", () => {
    const result = sitemap();
    const homepage = result.find((e) => e.url === "https://themagiclab.app");
    expect(homepage).toBeDefined();
  });

  it("homepage has priority 1 and weekly frequency", () => {
    const result = sitemap();
    const homepage = result.find((e) => e.url === "https://themagiclab.app");
    expect(homepage?.priority).toBe(1);
    expect(homepage?.changeFrequency).toBe("weekly");
  });

  it("includes privacy and FAQ pages", () => {
    const result = sitemap();
    const urls = result.map((e) => e.url);
    expect(urls).toContain("https://themagiclab.app/privacy");
    expect(urls).toContain("https://themagiclab.app/faq");
  });

  it("sets lastModified to Date instances", () => {
    const result = sitemap();
    for (const entry of result) {
      expect(entry.lastModified).toBeInstanceOf(Date);
    }
  });
});
