import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { THEME_PROVIDER_PROPS } from "../src/components/theme-provider";
import { LANG_SCRIPT } from "../src/lib/lang-script";

// ---------------------------------------------------------------------------
// Exported constants and helpers — used by both the script and its tests
// ---------------------------------------------------------------------------

// This regex targets the minified output of next-themes and is inherently
// fragile — a version bump or bundler change may alter the variable names.
// The script exits non-zero on mismatch, and the test in csp.test.ts
// independently verifies hashes by rendering ThemeProvider in JSDOM.
// If a next-themes update breaks this regex, update the pattern to match
// the new minified structure and re-run: pnpm hash:csp
export const ANTI_FLICKER_REGEX = /var M=([\s\S]*?);var b=/;

export function extractAntiFlicker(source: string): string {
  const match = source.match(ANTI_FLICKER_REGEX);
  const fn = match?.[1];
  if (!fn) {
    throw new Error("Failed to extract anti-flicker function from next-themes");
  }
  return fn;
}

export const HASH_PATTERN =
  /const LANG_SCRIPT_HASH =\n\s*"'sha256-[A-Za-z0-9+/=]+'";?\nconst THEME_SCRIPT_HASH =\n\s*"'sha256-[A-Za-z0-9+/=]+'";?/;

export function replaceHashes(
  source: string,
  langHash: string,
  themeHash: string
): string | null {
  if (!HASH_PATTERN.test(source)) {
    return null;
  }
  // Use a functional replacer to avoid $-pattern substitution in replacement strings.
  const updated = source.replace(
    HASH_PATTERN,
    () =>
      `const LANG_SCRIPT_HASH =\n  "'sha256-${langHash}'";\nconst THEME_SCRIPT_HASH =\n  "'sha256-${themeHash}'";`
  );
  return updated === source ? source : updated;
}

// ---------------------------------------------------------------------------
// CLI script — only runs when executed directly (not when imported by tests)
// ---------------------------------------------------------------------------
const isDirectRun = process.argv[1]?.endsWith("compute-csp-hashes.ts") ?? false;

if (isDirectRun) {
  const ROOT = resolve(import.meta.dirname, "..");
  const nextThemesPkgRaw: unknown = JSON.parse(
    readFileSync(
      resolve(ROOT, "node_modules/next-themes/package.json"),
      "utf-8"
    )
  );
  if (
    typeof nextThemesPkgRaw !== "object" ||
    nextThemesPkgRaw === null ||
    !("version" in nextThemesPkgRaw) ||
    typeof nextThemesPkgRaw.version !== "string"
  ) {
    console.error("Could not read version from next-themes/package.json.");
    process.exit(1);
  }
  console.log(`next-themes version: ${nextThemesPkgRaw.version}`);

  function sha256Base64(content: string): string {
    return createHash("sha256").update(content, "utf-8").digest("base64");
  }

  // -------------------------------------------------------------------------
  // 1. LANG_SCRIPT hash — imported directly from our own source
  // -------------------------------------------------------------------------
  const langHash = sha256Base64(LANG_SCRIPT);

  // -------------------------------------------------------------------------
  // 2. next-themes ThemeProvider anti-flicker script hash
  //
  // The ThemeProvider injects: `(${M.toString()})(${params})`
  // M is an internal function in next-themes/dist/index.mjs.
  // Params are serialized from the ThemeProvider props in src/app/layout.tsx:
  //   attribute="class", defaultTheme="system", enableSystem=true
  //   (storageKey, themes, value, enableColorScheme use their defaults)
  // -------------------------------------------------------------------------
  const nextThemesPath = resolve(
    ROOT,
    "node_modules/next-themes/dist/index.mjs"
  );
  const nextThemesSource = readFileSync(nextThemesPath, "utf-8");

  const mFunctionSource = extractAntiFlicker(nextThemesSource);

  // Sanity check: the extracted function should contain theme-detection patterns.
  // If the regex matched the wrong block, this catches it early.
  if (
    !(
      mFunctionSource.includes("localStorage") &&
      mFunctionSource.includes("document")
    )
  ) {
    console.error(
      "Extracted function does not contain expected theme-detection patterns " +
        "(localStorage, document). The regex may have captured the wrong function."
    );
    process.exit(1);
  }

  // Replicate the ThemeScript serialization:
  // JSON.stringify([attribute, storageKey, defaultTheme, forcedTheme, themes, value, enableSystem, enableColorScheme]).slice(1,-1)
  const params = JSON.stringify([
    THEME_PROVIDER_PROPS.attribute,
    "theme", // storageKey (default)
    THEME_PROVIDER_PROPS.defaultTheme,
    undefined, // forcedTheme
    ["light", "dark"], // themes (default)
    undefined, // value
    THEME_PROVIDER_PROPS.enableSystem,
    true, // enableColorScheme (default)
  ]).slice(1, -1);

  const themeScript = `(${mFunctionSource})(${params})`;
  const themeHash = sha256Base64(themeScript);

  // -------------------------------------------------------------------------
  // 3. Update csp.ts in place
  // -------------------------------------------------------------------------
  const cspPath = resolve(ROOT, "src/lib/csp.ts");
  const cspSource = readFileSync(cspPath, "utf-8");

  const BASE64_RE = /^[A-Za-z0-9+/=]{44}$/;
  if (!(BASE64_RE.test(langHash) && BASE64_RE.test(themeHash))) {
    console.error("Computed hash contains unexpected characters.");
    process.exit(1);
  }

  const result = replaceHashes(cspSource, langHash, themeHash);

  if (result === null) {
    console.error(
      "Could not find LANG_SCRIPT_HASH / THEME_SCRIPT_HASH in src/lib/csp.ts. " +
        "Has the format changed?"
    );
    process.exit(1);
  }

  if (result === cspSource) {
    console.log("CSP hashes are up to date.");
  } else {
    writeFileSync(cspPath, result, "utf-8");
    console.log("Updated CSP hashes in src/lib/csp.ts:");
    console.log(`  LANG_SCRIPT:  sha256-${langHash}`);
    console.log(`  next-themes:  sha256-${themeHash}`);
  }
}
