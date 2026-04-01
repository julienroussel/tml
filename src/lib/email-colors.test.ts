import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatHex, parse } from "culori";
import { describe, expect, it } from "vitest";
import {
  backgroundHex,
  foregroundHex,
  mutedForegroundHex,
  mutedHex,
  primaryForegroundHex,
  primaryHex,
} from "./email-colors";

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;
const ROOT_BLOCK_PATTERN = /:root\s*\{([^}]+)\}/;
const CSS_PROP_PATTERN = /--([\w-]+)\s*:\s*([^;]+)/g;

const colors: Record<string, string> = {
  primaryHex,
  primaryForegroundHex,
  foregroundHex,
  mutedForegroundHex,
  backgroundHex,
  mutedHex,
};

/** Map of CSS token name → exported constant */
const TOKEN_TO_EXPORT: Record<string, string> = {
  "--primary": primaryHex,
  "--primary-foreground": primaryForegroundHex,
  "--foreground": foregroundHex,
  "--muted-foreground": mutedForegroundHex,
  "--background": backgroundHex,
  "--muted": mutedHex,
};

/**
 * Parse the :root block from globals.css and convert each oklch token
 * to hex via culori. This lets the test catch drift between the CSS
 * theme and the hardcoded email constants.
 */
function parseThemeHex(): Record<string, string> {
  const css = readFileSync(
    resolve(import.meta.dirname, "../app/globals.css"),
    "utf-8"
  );
  const rootBlock = css.match(ROOT_BLOCK_PATTERN)?.[1] ?? "";
  const result: Record<string, string> = {};
  for (const match of rootBlock.matchAll(CSS_PROP_PATTERN)) {
    const prop = `--${match[1]}`;
    const value = match[2]?.trim();
    if (!value) {
      continue;
    }
    const color = parse(value);
    if (color) {
      result[prop] = formatHex(color);
    }
  }
  return result;
}

describe("email-colors", () => {
  for (const [name, value] of Object.entries(colors)) {
    it(`${name} is a valid 6-digit hex color`, () => {
      expect(value).toMatch(HEX_PATTERN);
    });
  }

  describe("stays in sync with globals.css theme tokens", () => {
    const themeHex = parseThemeHex();

    for (const [token, exportedValue] of Object.entries(TOKEN_TO_EXPORT)) {
      it(`${token} matches globals.css`, () => {
        const expected = themeHex[token];
        expect(expected).toBeDefined();
        expect(exportedValue).toBe(expected);
      });
    }
  });
});
