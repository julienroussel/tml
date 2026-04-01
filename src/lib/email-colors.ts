import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatHex, parse } from "culori";

/**
 * Hex color constants for email templates, derived from the light-mode
 * `:root` theme in `globals.css`.
 *
 * Emails require inline hex values (no CSS variables, no oklch).
 * Instead of hardcoding hex, we read the oklch tokens from the CSS
 * source of truth and convert them with culori at module load time.
 */

const GLOBALS_CSS_PATH = join(process.cwd(), "src/app/globals.css");

/** Token names we need in emails, mapped to their export name. */
const TOKEN_MAP = {
  "--primary": "primaryHex",
  "--primary-foreground": "primaryForegroundHex",
  "--foreground": "foregroundHex",
  "--muted-foreground": "mutedForegroundHex",
  "--background": "backgroundHex",
  "--muted": "mutedHex",
} as const;

type TokenExportName = (typeof TOKEN_MAP)[keyof typeof TOKEN_MAP];

// Assumes :root contains no nested blocks (no inner {}). If this changes,
// switch to a brace-depth-aware parser.
const ROOT_BLOCK_PATTERN = /:root\s*\{([^}]+)\}/;
const CSS_PROP_PATTERN = /--([\w-]+)\s*:\s*([^;]+)/g;

function isTokenProp(key: string): key is keyof typeof TOKEN_MAP {
  return key in TOKEN_MAP;
}

function parseThemeTokens(): Record<TokenExportName, string> {
  const css = readFileSync(GLOBALS_CSS_PATH, "utf-8");

  const rootBlock = css.match(ROOT_BLOCK_PATTERN)?.[1];
  if (!rootBlock) {
    throw new Error("Could not find :root block in globals.css");
  }

  const result: Partial<Record<TokenExportName, string>> = {};

  for (const match of rootBlock.matchAll(CSS_PROP_PATTERN)) {
    const prop = `--${match[1]}`;
    if (!isTokenProp(prop)) {
      continue;
    }

    const oklchValue = match[2]?.trim();
    if (!oklchValue) {
      continue;
    }
    const color = parse(oklchValue);
    if (!color) {
      throw new Error(`culori could not parse "${oklchValue}" for ${prop}`);
    }

    result[TOKEN_MAP[prop]] = formatHex(color);
  }

  const missing = Object.values(TOKEN_MAP).filter((key) => !(key in result));
  if (missing.length > 0) {
    throw new Error(`Missing CSS tokens in :root: ${missing.join(", ")}`);
  }

  // Safe: the missing-check above guarantees all keys are present.
  return result as Record<TokenExportName, string>;
}

const tokens = parseThemeTokens();

/** Button background — derived from `--primary` */
export const primaryHex: string = tokens.primaryHex;

/** Button text — derived from `--primary-foreground` */
export const primaryForegroundHex: string = tokens.primaryForegroundHex;

/** Heading & body text — derived from `--foreground` */
export const foregroundHex: string = tokens.foregroundHex;

/** Footer & secondary text — derived from `--muted-foreground` */
export const mutedForegroundHex: string = tokens.mutedForegroundHex;

/** Container / card background — derived from `--background` */
export const backgroundHex: string = tokens.backgroundHex;

/** Outer email background — derived from `--muted` */
export const mutedHex: string = tokens.mutedHex;
