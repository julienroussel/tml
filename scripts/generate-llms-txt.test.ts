import { describe, expect, it } from "vitest";
import { generateLlmsFullTxt, generateLlmsTxt } from "./generate-llms-txt";

describe("generateLlmsTxt", () => {
  it("starts with a top-level heading", () => {
    const output = generateLlmsTxt();
    expect(output.startsWith("# The Magic Lab\n")).toBe(true);
  });

  it("includes the tagline as a blockquote", () => {
    const output = generateLlmsTxt();
    expect(output).toContain("> Train. Plan. Perform. Elevate your magic.");
  });

  it("includes product-summary section headings", () => {
    const output = generateLlmsTxt();
    expect(output).toContain("## Who it is for");
    expect(output).toContain("## What it does today");
    expect(output).toContain("## Why it is different");
    expect(output).toContain("## Links");
  });

  it("mentions the enabled modules so AI summaries describe the real surface", () => {
    const output = generateLlmsTxt();
    expect(output).toContain("Repertoire");
    expect(output).toContain("Collection");
    expect(output).toContain("Activity");
  });

  it("marks upcoming modules as in development so AI summaries do not overstate the product", () => {
    const output = generateLlmsTxt();
    expect(output).toContain("Improve");
    expect(output).toContain("Train");
    expect(output).toContain("Plan");
    expect(output).toContain("Perform");
    expect(output).toContain("Enhance");
    expect(output).toContain("in development");
  });

  it("includes links with the production URL", () => {
    const output = generateLlmsTxt();
    expect(output).toContain("https://themagiclab.app");
  });

  it("includes public pages", () => {
    const output = generateLlmsTxt();
    expect(output).toContain("/privacy");
    expect(output).toContain("/faq");
  });

  it("includes an ## Optional section with full docs link", () => {
    const output = generateLlmsTxt();
    expect(output).toContain("## Optional");
    expect(output).toContain("llms-full.txt");
  });

  it("ends with a trailing newline", () => {
    const output = generateLlmsTxt();
    expect(output.endsWith("\n")).toBe(true);
  });
});

describe("generateLlmsFullTxt", () => {
  it("starts with a top-level heading", () => {
    const output = generateLlmsFullTxt();
    expect(output.startsWith("# The Magic Lab")).toBe(true);
  });

  it("includes a blockquote description", () => {
    const output = generateLlmsFullTxt();
    expect(output).toContain("> A free, open-source workspace for magicians");
  });

  it("includes content from documentation files", () => {
    const output = generateLlmsFullTxt();
    expect(output).toContain("Architecture Overview");
    expect(output).toContain("Data Model");
    expect(output).toContain("Sync Engine");
  });

  it("includes source file references", () => {
    const output = generateLlmsFullTxt();
    expect(output).toContain("Source: docs/architecture.md");
    expect(output).toContain("Source: docs/data-model.md");
  });

  it("includes diagram content", () => {
    const output = generateLlmsFullTxt();
    expect(output).toContain("Source: docs/diagrams/schema-er.md");
  });

  it("includes section separators", () => {
    const output = generateLlmsFullTxt();
    expect(output).toContain("---");
  });

  it("ends with a trailing newline", () => {
    const output = generateLlmsFullTxt();
    expect(output.endsWith("\n")).toBe(true);
  });

  it("contains all documentation sections", () => {
    const output = generateLlmsFullTxt();
    const expectedDocs = [
      "architecture.md",
      "auth-flow.md",
      "csp-policy.md",
      "data-model.md",
      "i18n.md",
      "local-development.md",
      "migrations.md",
      "product-overview.md",
      "pwa-notifications.md",
      "route-structure.md",
      "sync-engine.md",
      "testing.md",
      "ui-conventions.md",
    ];

    for (const doc of expectedDocs) {
      expect(output).toContain(`Source: docs/${doc}`);
    }
  });

  it("places product-overview.md as the first source section", () => {
    const output = generateLlmsFullTxt();
    const sources = [...output.matchAll(/^Source: docs\/(.+)$/gm)].map(
      (m) => m[1]
    );
    expect(sources[0]).toBe("product-overview.md");
  });
});
