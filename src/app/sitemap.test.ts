import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";

describe("sitemap", () => {
  it("returns an array with at least one entry", () => {
    const result = sitemap();
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("uses the correct production URL", () => {
    const [entry] = sitemap();
    expect(entry.url).toBe("https://themagiclab.app");
  });

  it("has a valid changeFrequency", () => {
    const [entry] = sitemap();
    expect(entry.changeFrequency).toBe("weekly");
  });

  it("has a valid priority", () => {
    const [entry] = sitemap();
    expect(entry.priority).toBe(1);
  });

  it("sets lastModified to a Date instance", () => {
    const [entry] = sitemap();
    expect(entry.lastModified).toBeInstanceOf(Date);
  });
});
