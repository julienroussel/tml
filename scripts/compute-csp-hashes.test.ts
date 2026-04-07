import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_PROVIDER_PROPS } from "../src/components/theme-provider";
import { LANG_SCRIPT } from "../src/lib/lang-script";
import {
  extractAntiFlicker,
  HASH_PATTERN,
  replaceHashes,
} from "./compute-csp-hashes";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256Base64(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("base64");
}

const ROOT = resolve(import.meta.dirname, "..");
const nextThemesPath = resolve(ROOT, "node_modules/next-themes/dist/index.mjs");
const nextThemesSource = readFileSync(nextThemesPath, "utf-8");

const BASE64_RE = /^[A-Za-z0-9+/=]{44}$/;
const STARTS_WITH_QUOTE = /^"/;
const ENDS_WITH_TRUE = /true$/;
const SELF_INVOKE_START = /^\(function\(\)/;
const SELF_INVOKE_END = /\)\(\)$/;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("compute-csp-hashes", () => {
  describe("regex extraction", () => {
    it("extracts a function from next-themes source", () => {
      const fn = extractAntiFlicker(nextThemesSource);
      expect(fn.length).toBeGreaterThan(0);
    });

    it("extraction contains localStorage pattern", () => {
      const fn = extractAntiFlicker(nextThemesSource);
      expect(fn).toContain("localStorage");
    });

    it("extraction contains document pattern", () => {
      const fn = extractAntiFlicker(nextThemesSource);
      expect(fn).toContain("document");
    });

    it("throws when regex does not match", () => {
      expect(() => extractAntiFlicker("invalid source")).toThrow(
        "Failed to extract anti-flicker function"
      );
    });
  });

  describe("hash output format", () => {
    it("LANG_SCRIPT hash is valid base64", () => {
      const hash = sha256Base64(LANG_SCRIPT);
      expect(hash).toMatch(BASE64_RE);
    });

    it("theme script hash is valid base64", () => {
      const mFunctionSource = extractAntiFlicker(nextThemesSource);

      const params = JSON.stringify([
        THEME_PROVIDER_PROPS.attribute,
        "theme",
        THEME_PROVIDER_PROPS.defaultTheme,
        undefined,
        ["light", "dark"],
        undefined,
        THEME_PROVIDER_PROPS.enableSystem,
        true,
      ]).slice(1, -1);

      const themeScript = `(${mFunctionSource})(${params})`;
      const hash = sha256Base64(themeScript);
      expect(hash).toMatch(BASE64_RE);
    });

    it("LANG_SCRIPT hash is a 44-char SHA-256 base64 digest", () => {
      const hash = sha256Base64(LANG_SCRIPT);
      // SHA-256 = 32 bytes → 44 base64 chars (with padding)
      expect(hash).toHaveLength(44);
    });
  });

  describe("HASH_PATTERN regex", () => {
    it("matches the actual csp.ts format", () => {
      const cspPath = resolve(import.meta.dirname, "../src/lib/csp.ts");
      const cspSource = readFileSync(cspPath, "utf-8");
      expect(cspSource).toMatch(HASH_PATTERN);
    });
  });

  describe("parameter serialization", () => {
    // These tests validate the expected serialization format independently.
    // The JSDOM-based test in src/lib/csp.test.ts is the authoritative hash
    // correctness check (it renders the actual ThemeProvider and verifies).

    it("uses class attribute from THEME_PROVIDER_PROPS", () => {
      expect(THEME_PROVIDER_PROPS.attribute).toBe("class");
    });

    it("uses system as default theme from THEME_PROVIDER_PROPS", () => {
      expect(THEME_PROVIDER_PROPS.defaultTheme).toBe("system");
    });

    it("has enableSystem true in THEME_PROVIDER_PROPS", () => {
      expect(THEME_PROVIDER_PROPS.enableSystem).toBe(true);
    });

    it("serializes params array matching ThemeScript expectations", () => {
      const params = JSON.stringify([
        THEME_PROVIDER_PROPS.attribute,
        "theme", // storageKey default
        THEME_PROVIDER_PROPS.defaultTheme,
        undefined, // forcedTheme
        ["light", "dark"], // themes default
        undefined, // value
        THEME_PROVIDER_PROPS.enableSystem,
        true, // enableColorScheme default
      ]).slice(1, -1);

      // Should contain all expected values as JSON-serialized fragments
      expect(params).toContain('"class"');
      expect(params).toContain('"theme"');
      expect(params).toContain('"system"');
      expect(params).toContain("null"); // undefined → null in JSON
      expect(params).toContain('["light","dark"]');
      expect(params).toContain("true");
    });

    it("params start and end correctly after slice(1,-1)", () => {
      const params = JSON.stringify([
        THEME_PROVIDER_PROPS.attribute,
        "theme",
        THEME_PROVIDER_PROPS.defaultTheme,
        undefined,
        ["light", "dark"],
        undefined,
        THEME_PROVIDER_PROPS.enableSystem,
        true,
      ]).slice(1, -1);

      // After slicing the outer brackets, params should start with a quote (first element)
      // and end with the last element's value
      expect(params).toMatch(STARTS_WITH_QUOTE);
      expect(params).toMatch(ENDS_WITH_TRUE);
    });
  });

  describe("LANG_SCRIPT content", () => {
    it("is a non-empty string", () => {
      expect(typeof LANG_SCRIPT).toBe("string");
      expect(LANG_SCRIPT.length).toBeGreaterThan(0);
    });

    it("is a self-invoking function", () => {
      expect(LANG_SCRIPT).toMatch(SELF_INVOKE_START);
      expect(LANG_SCRIPT).toMatch(SELF_INVOKE_END);
    });

    it("contains all supported locales", () => {
      for (const locale of ["en", "fr", "es", "pt", "it", "de", "nl"]) {
        expect(LANG_SCRIPT).toContain(`"${locale}"`);
      }
    });
  });

  describe("replaceHashes", () => {
    // Use realistic 44-character base64 strings matching SHA-256 digest length.
    const validSource = [
      "const LANG_SCRIPT_HASH =",
      "  \"'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='\";",
      "const THEME_SCRIPT_HASH =",
      "  \"'sha256-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB='\";",
    ].join("\n");

    it("replaces hash values in valid source", () => {
      const result = replaceHashes(
        validSource,
        "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=",
        "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD="
      );
      expect(result).toContain("CCCCCCC");
      expect(result).not.toContain("AAAAAAA");
    });

    it("produces output matching expected csp.ts format", () => {
      const result = replaceHashes(
        validSource,
        "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=",
        "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD="
      );
      const expected = [
        "const LANG_SCRIPT_HASH =",
        "  \"'sha256-CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC='\";",
        "const THEME_SCRIPT_HASH =",
        "  \"'sha256-DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD='\";",
      ].join("\n");
      expect(result).toBe(expected);
    });

    it("replacement output is re-matchable by HASH_PATTERN", () => {
      const result = replaceHashes(
        validSource,
        "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=",
        "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD="
      );
      expect(result).not.toBeNull();
      expect(result).toMatch(HASH_PATTERN);
    });

    it("returns source unchanged when hashes already match", () => {
      const result = replaceHashes(
        validSource,
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB="
      );
      expect(result).toBe(validSource);
    });

    it("returns null when pattern does not match", () => {
      const result = replaceHashes("no hashes here", "abc", "def");
      expect(result).toBeNull();
    });
  });
});
