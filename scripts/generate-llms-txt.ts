import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const DOCS_DIR = join(import.meta.dirname, "..", "docs");
const PUBLIC_DIR = join(import.meta.dirname, "..", "public");
const BASE_URL = "https://themagiclab.app";

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

function readDocFile(filePath: string): string {
  return readFileSync(filePath, "utf-8");
}

export function generateLlmsTxt(): string {
  const lines = [
    "# The Magic Lab",
    "",
    "> A free, open-source workspace for magicians to organize their repertoire,",
    "> plan routines, track practice sessions, and refine performances.",
    "",
    "## Docs",
    "",
    `- [Home](${BASE_URL}): Overview and features`,
    `- [Privacy](${BASE_URL}/privacy): Privacy policy`,
    `- [FAQ](${BASE_URL}/faq): Common questions`,
    "",
    "## Optional",
    "",
    `- [Full docs](${BASE_URL}/llms-full.txt): Complete documentation`,
  ];

  return `${lines.join("\n")}\n`;
}

export function generateLlmsFullTxt(): string {
  const files = collectMarkdownFiles(DOCS_DIR);
  const sections: string[] = [
    "# The Magic Lab -- Complete Documentation",
    "",
    "> A free, open-source workspace for magicians to organize their repertoire,",
    "> plan routines, track practice sessions, and refine performances.",
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
