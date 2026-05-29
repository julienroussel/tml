// Postbuild secret-scan tripwire. RUNS AS THE `postbuild` npm lifecycle hook
// (package.json), which fires only when the build is invoked via `pnpm build`
// (pnpm runs pre/post scripts by default). Vercel's `buildCommand` and CI MUST
// stay `pnpm build` — switching to `next build` directly, or setting
// `enable-pre-post-scripts=false`, silently disables this scan. (#341)
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

interface SecretPattern {
  name: string;
  re: RegExp;
}

interface SecretFinding {
  file: string;
  patterns: string[];
}

interface ScanResult {
  findings: SecretFinding[];
  scannedCount: number;
  sourceMapCount: number;
}

// Denylist of known secret-marker SHAPES that must not appear in browser-shipped
// assets. This is a tripwire, NOT a complete secret detector: a high-entropy or
// base64 secret with no recognizable prefix would pass. It targets the leak
// vectors that matter most here — Neon credential values (`npg_`, postgres URIs)
// and PEM private keys.
//
// `DATABASE_URL` / `POWERSYNC_ADMIN_TOKEN` are env-var NAME patterns, not value
// patterns: those names rarely survive client minification (Next.js dead-code-
// eliminates server-only `process.env` reads from client bundles), so a match
// flags a `next.config` `env`/`define` misconfig that inlined the name — a
// tripwire, not the primary leak path. Validated against a real production build
// (#341): zero matches on a clean build.
//
// Scope: `.next/static/**` (client JS/CSS/maps) is scanned with the FULL
// denylist. `.next/server/{app,pages}/**/*.{html,rsc,body}` (prerendered pages,
// RSC flight data, and route-handler response bodies — all served verbatim to
// browsers) is scanned with the VALUE-shape subset only: env-var NAME patterns
// (`DATABASE_URL`, `POWERSYNC_ADMIN_TOKEN`) and the override flag legitimately
// appear in server output and would false-positive there. Server JS
// (`.next/server/**/*.js`) is NOT scanned for the same reason. See
// `VALUE_SHAPE_PATTERNS` and the main block below.
//
// The JWT-shape pattern `eyJ…\.…\.…` is intentionally NOT included: `@neondatabase/auth`
// ships client-side JWT handling, so JWT-shaped fixture strings can legitimately appear
// in vendored chunks. It stays in the manual audit grep (#341 plan, Step 1a) only.
const SECRET_PATTERNS: readonly SecretPattern[] = [
  // Neon Postgres password value prefix.
  { name: "neon-password", re: /npg_[A-Za-z0-9]/ },
  // Any Postgres connection URI carrying inline credentials.
  {
    name: "postgres-uri-credentials",
    re: /postgres(?:ql)?:\/\/[^"'\s]*:[^"'@\s]+@/,
  },
  // PEM private key block.
  { name: "pem-private-key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  // Env-var NAME tripwire — flags a build-time inline misconfig, not a live value.
  { name: "powersync-admin-token", re: /POWERSYNC_ADMIN_TOKEN/ },
  // Env-var NAME tripwire — flags a build-time inline misconfig, not a live value.
  { name: "database-url", re: /DATABASE_URL/ },
  // Known-internal E2E override flag — must tree-shake out of prod (#341 Finding #17).
  { name: "test-bucket-health-override", re: /__TEST_FORCE_BUCKET_HEALTH/ },
];

// Value-shape patterns match an actual secret VALUE (not an env-var name or an
// internal flag), so they are safe to run against server-rendered HTML/RSC where
// env-var names legitimately appear. Used for the `.next/server/{app,pages}` scan.
const VALUE_SHAPE_PATTERN_NAMES = new Set([
  "neon-password",
  "postgres-uri-credentials",
  "pem-private-key",
]);
const VALUE_SHAPE_PATTERNS: readonly SecretPattern[] = SECRET_PATTERNS.filter(
  (p) => VALUE_SHAPE_PATTERN_NAMES.has(p.name)
);

// Client bundles under `.next/static`.
const SCANNED_EXTENSIONS = /\.(?:js|css|map)$/;
// Browser-served output under `.next/server/{app,pages}`: prerendered HTML, RSC
// flight data, and `.body` response bodies (sitemap, manifest, error pages).
const SERVER_OUTPUT_EXTENSIONS = /\.(?:html|rsc|body)$/;

/**
 * Returns the names of every secret-marker pattern that matches `content`.
 * Pure and side-effect-free so the denylist can be unit-tested without a build.
 */
export function findSecretMarkers(
  content: string,
  patterns: readonly SecretPattern[] = SECRET_PATTERNS
): string[] {
  const hits: string[] = [];
  for (const { name, re } of patterns) {
    if (re.test(content)) {
      hits.push(name);
    }
  }
  return hits;
}

function collectAssetFiles(dir: string, extensions: RegExp): string[] {
  // `withFileTypes` lets us filter on `Dirent.isFile()` without a follow-up
  // `statSync` per entry. `isFile()` does NOT follow symlinks, so a broken or
  // looping symlink whose name matches `extensions` is skipped rather than
  // throwing — and it drops one syscall per asset.
  const entries = readdirSync(dir, { recursive: true, withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (!(entry.isFile() && extensions.test(entry.name))) {
      continue;
    }
    files.push(join(entry.parentPath, entry.name));
  }
  return files;
}

/**
 * Walks `dir` recursively and scans every matching asset for the given secret
 * patterns. Returns findings plus counts. Free of process state (no exit, no
 * console) so it is unit-testable against a temp fixture directory.
 */
export function scanDirectory(
  dir: string,
  patterns: readonly SecretPattern[] = SECRET_PATTERNS,
  extensions: RegExp = SCANNED_EXTENSIONS
): ScanResult {
  const files = collectAssetFiles(dir, extensions);
  const findings: SecretFinding[] = [];
  let sourceMapCount = 0;
  for (const file of files) {
    if (file.endsWith(".map")) {
      sourceMapCount++;
    }
    const matched = findSecretMarkers(readFileSync(file, "utf8"), patterns);
    if (matched.length > 0) {
      findings.push({ file, patterns: matched });
    }
  }
  return { findings, scannedCount: files.length, sourceMapCount };
}

// Scans `dir` if it exists, else returns an empty result — so an absent
// `.next/server/{app,pages}` subtree is a no-op rather than a throw.
function scanIfExists(
  dir: string,
  patterns: readonly SecretPattern[],
  extensions: RegExp
): ScanResult {
  return existsSync(dir)
    ? scanDirectory(dir, patterns, extensions)
    : { findings: [], scannedCount: 0, sourceMapCount: 0 };
}

export type { ScanResult, SecretFinding, SecretPattern };
export { SECRET_PATTERNS, SERVER_OUTPUT_EXTENSIONS, VALUE_SHAPE_PATTERNS };

const isMainModule =
  process.argv[1]?.endsWith("check-bundle-secrets.ts") ?? false;

if (isMainModule) {
  const nextDir = resolve(import.meta.dirname, "../.next");
  const staticDir = join(nextDir, "static");
  const serverAppDir = join(nextDir, "server", "app");
  const serverPagesDir = join(nextDir, "server", "pages");

  if (existsSync(nextDir) && !existsSync(staticDir)) {
    // A build exists but emitted no client assets — a misconfiguration (custom
    // distDir, relocated output). Fail closed: this is exactly the case the
    // tripwire must surface loudly rather than silently pass. The lenient skip
    // below only applies when there is no build at all (`.next` absent).
    console.error(
      "[check-bundle-secrets] FAIL — .next exists but .next/static is missing; the build produced no client assets to scan."
    );
    process.exitCode = 1;
  } else if (existsSync(staticDir)) {
    // Client bundles get the FULL denylist. Prerendered server output (also
    // browser-served) gets the value-shape subset so server-side env-var NAMES
    // don't false-positive.
    const staticResult = scanDirectory(staticDir);
    const results = [
      staticResult,
      scanIfExists(
        serverAppDir,
        VALUE_SHAPE_PATTERNS,
        SERVER_OUTPUT_EXTENSIONS
      ),
      scanIfExists(
        serverPagesDir,
        VALUE_SHAPE_PATTERNS,
        SERVER_OUTPUT_EXTENSIONS
      ),
    ];

    const findings = results.flatMap((r) => r.findings);
    const scannedCount = results.reduce((n, r) => n + r.scannedCount, 0);

    // Client source maps in `.next/static` expand the exposure surface (original
    // source becomes fetchable). Surface their presence; their contents are scanned too.
    if (staticResult.sourceMapCount > 0) {
      console.warn(
        `[check-bundle-secrets] NOTE: ${staticResult.sourceMapCount} client source map(s) present in .next/static — these expand the exposure surface (consider productionBrowserSourceMaps: false). Scanning their contents too.`
      );
    }

    if (findings.length > 0) {
      console.error(
        "[check-bundle-secrets] FAIL — secret markers found in browser-shipped assets:"
      );
      for (const { file, patterns } of findings) {
        console.error(`  ${file} → ${patterns.join(", ")}`);
      }
      // Set `process.exitCode` rather than calling `process.exit(1)`: the latter
      // can truncate the per-file detail lines above when stderr is a pipe (the
      // normal case in CI), leaving a failed build with no leak diagnostics.
      process.exitCode = 1;
    } else {
      console.log(
        `[check-bundle-secrets] OK — scanned ${scannedCount} asset(s) under .next/static + .next/server/{app,pages}, no secret markers.`
      );
    }
  } else {
    console.log(
      "[check-bundle-secrets] .next/static not found — skipping (no build present)."
    );
  }
}
