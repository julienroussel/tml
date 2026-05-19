import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const DOCS_DIR = join(import.meta.dirname, "..", "docs");
const PUBLIC_DIR = join(import.meta.dirname, "..", "public");
const BASE_URL = "https://themagiclab.app";

const PRODUCT_OVERVIEW_FILENAME = "product-overview.md";

function collectMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
    } else if (entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function orderDocFiles(files: string[]): string[] {
  const overviewPath = files.find((f) =>
    f.endsWith(`/${PRODUCT_OVERVIEW_FILENAME}`)
  );
  const rest = files.filter((f) => f !== overviewPath);
  return overviewPath ? [overviewPath, ...rest] : rest;
}

function readDocFile(filePath: string): string {
  return readFileSync(filePath, "utf-8");
}

export function generateLlmsTxt(): string {
  const lines = [
    "# The Magic Lab",
    "",
    "> Train. Plan. Perform. Elevate your magic.",
    "",
    "The Magic Lab is a free, open-source, offline-first workspace built for",
    "magicians. It is a single place to organize your repertoire, plan setlists,",
    "track practice and performance, and grow your craft over time.",
    "",
    "## Who it is for",
    "",
    "Working magicians, hobbyists, and students — from someone learning their",
    "first sleights to a touring professional. The app is mobile-first and",
    "installs as a Progressive Web App that works fully offline.",
    "",
    "## What it does today",
    "",
    "- **Repertoire** — structured catalog of tricks (category, effect type,",
    "  difficulty, status, props, music, languages, angle sensitivity, notes,",
    "  tags).",
    "- **Collection** — inventory of props, books, gimmicks, DVDs, downloads,",
    "  decks, etc., linkable to the tricks that use them.",
    "- **Activity** — canonical timeline of everything you've done in the app.",
    "",
    "Improve, Train, Plan, Perform, and Enhance modules are in development and",
    "appear as upcoming placeholders.",
    "",
    "## Why it is different",
    "",
    "- Built for magicians, by a magician — a domain-specific data model, not",
    "  a general notes app.",
    "- Offline-first via PowerSync + local SQLite; Neon Postgres is downstream.",
    "- Free and open source under GPL-3.0. No paid tiers, no ads.",
    "- No user data is sent to third-party AI providers.",
    "- Available in English, French, Spanish, Portuguese, Italian, German, Dutch.",
    "",
    "## Links",
    "",
    `- [Home](${BASE_URL}/en): Landing page and feature overview`,
    `- [FAQ](${BASE_URL}/en/faq): Common questions`,
    `- [Privacy](${BASE_URL}/en/privacy): Privacy policy`,
    "- [Source](https://github.com/julienroussel/tml): GitHub repository",
    "",
    "## Optional",
    "",
    `- [Full docs](${BASE_URL}/llms-full.txt): Complete product + technical documentation`,
  ];

  return `${lines.join("\n")}\n`;
}

export function generateLlmsFullTxt(): string {
  const files = orderDocFiles(collectMarkdownFiles(DOCS_DIR));
  const sections: string[] = [
    "# The Magic Lab -- Complete Documentation",
    "",
    "> A free, open-source workspace for magicians to organize their repertoire,",
    "> plan setlists, track practice sessions, and refine performances.",
    "> Production URL: https://themagiclab.app/",
    "> GitHub: https://github.com/julienroussel/tml",
    "",
  ];

  for (const filePath of files) {
    const relativePath = relative(DOCS_DIR, filePath);
    const content = readDocFile(filePath);
    sections.push("---");
    sections.push(`Source: docs/${relativePath}`);
    sections.push("");
    sections.push(content.trim());
    sections.push("");
  }

  return `${sections.join("\n")}\n`;
}

function main(): void {
  const llmsTxt = generateLlmsTxt();
  const llmsFullTxt = generateLlmsFullTxt();

  const llmsPath = join(PUBLIC_DIR, "llms.txt");
  const llmsFullPath = join(PUBLIC_DIR, "llms-full.txt");

  writeFileSync(llmsPath, llmsTxt, "utf-8");
  writeFileSync(llmsFullPath, llmsFullTxt, "utf-8");

  const fileCount = collectMarkdownFiles(DOCS_DIR).length;

  console.log(`Generated ${llmsPath} (${llmsTxt.length} bytes)`);
  console.log(
    `Generated ${llmsFullPath} (${llmsFullTxt.length} bytes, ${fileCount} docs)`
  );
}

main();
