import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateMermaid, generateRouteMap } from "./generate-route-map";

const PROJECT_ROOT = join(import.meta.dirname, "..");

describe("generateMermaid", () => {
  it("produces a valid mermaid graph", () => {
    const appDir = join(PROJECT_ROOT, "src", "app");
    const result = generateMermaid(appDir);
    expect(result).toContain("graph TD");
    expect(result).toContain('root["src/app/"]');
  });

  it("includes marketing and app route groups", () => {
    const appDir = join(PROJECT_ROOT, "src", "app");
    const result = generateMermaid(appDir);
    expect(result).toContain("(marketing)");
    expect(result).toContain("(app)");
  });
});

describe("generateRouteMap", () => {
  it("produces a markdown document with headers", () => {
    const result = generateRouteMap(PROJECT_ROOT);
    expect(result).toContain("# Route Map");
    expect(result).toContain("## Route Groups");
  });

  it("lists marketing and app routes", () => {
    const result = generateRouteMap(PROJECT_ROOT);
    expect(result).toContain("(marketing)");
    expect(result).toContain("(app)");
  });

  it("includes a mermaid code block", () => {
    const result = generateRouteMap(PROJECT_ROOT);
    expect(result).toContain("```mermaid");
  });
});
