import { describe, expect, it } from "vitest";
import { generateLlmsFullTxt, generateLlmsTxt } from "./generate-llms-txt";

describe("generateLlmsTxt", () => {
  it("starts with a top-level heading", () => {
    const output = generateLlmsTxt();
    expect(output.startsWith("# The Magic Lab\n")).toBe(true);
  });

  it("includes a blockquote description", () => {
    const output = generateLlmsTxt();
    expect(output).toContain("> A free, open-source workspace for magicians");
  });

  it("includes a ## Docs section", () => {
    const output = generateLlmsTxt();
    expect(output).toContain("## Docs");
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
});
