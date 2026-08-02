// Postbuild tripwire for PowerSync's browser assets. RUNS AS THE `postbuild`
// npm lifecycle hook (package.json), alongside `check-bundle-secrets.ts`.
//
// `public/powersync/` is gitignored and produced only by the `powersync:assets`
// script. It used to run from `postinstall` alone, which meant any build whose
// `node_modules` was restored from cache ("Already up to date" — pnpm runs no
// lifecycle scripts) shipped with no worker and no WASM. PowerSync then fails
// to open its local database and the app silently degrades: sync never starts,
// offline-first is dead, and nothing fails loudly. `src/sync/system.ts` calls
// this out ("If it 404s, PowerSync silently degrades rather than failing
// loudly, and no automated gate catches that drift today") — this is that gate.
//
// The copy now also runs from `prebuild`, so this check asserts the invariant
// rather than being the primary defence.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

interface AssetCheckResult {
  missing: string[];
  wasmCount: number;
}

// Must match POWERSYNC_WORKER in src/sync/system.ts. If that constant changes,
// change this one in the same commit.
const REQUIRED_WORKER = "worker.js";
const ASSETS_DIR = "assets";

/**
 * Verifies the PowerSync browser assets are present under `dir`. Pure and
 * side-effect-free (no exit, no console) so it is unit-testable against a temp
 * fixture directory.
 */
export function checkPowerSyncAssets(dir: string): AssetCheckResult {
  const missing: string[] = [];

  if (!existsSync(dir)) {
    return { missing: [dir], wasmCount: 0 };
  }

  const worker = join(dir, REQUIRED_WORKER);
  if (!(existsSync(worker) && statSync(worker).size > 0)) {
    missing.push(worker);
  }

  const assetsDir = join(dir, ASSETS_DIR);
  if (!existsSync(assetsDir)) {
    return { missing: [...missing, assetsDir], wasmCount: 0 };
  }

  // The wa-sqlite WASM filenames are content-hashed, so assert on presence
  // rather than exact names — those rotate on every upstream build.
  const wasmCount = readdirSync(assetsDir).filter((f) =>
    f.endsWith(".wasm")
  ).length;

  return { missing, wasmCount };
}

export type { AssetCheckResult };
export { ASSETS_DIR, REQUIRED_WORKER };

const isMainModule =
  process.argv[1]?.endsWith("check-powersync-assets.ts") ?? false;

if (isMainModule) {
  const dir = resolve(import.meta.dirname, "..", "public", "powersync");
  const { missing, wasmCount } = checkPowerSyncAssets(dir);

  if (missing.length > 0 || wasmCount === 0) {
    console.error(
      "[check-powersync-assets] FAIL — PowerSync browser assets are missing from the build."
    );
    for (const path of missing) {
      console.error(`  missing: ${path}`);
    }
    if (wasmCount === 0) {
      console.error("  missing: no .wasm files under public/powersync/assets");
    }
    console.error(
      "  Run `pnpm powersync:assets` to regenerate. If this fired in CI, the build ran with a cached node_modules and skipped postinstall — `prebuild` should have covered it."
    );
    // Set `process.exitCode` rather than `process.exit(1)`: the latter can
    // truncate the detail lines above when stderr is a pipe (the CI case).
    process.exitCode = 1;
  } else {
    console.log(
      `[check-powersync-assets] OK — ${REQUIRED_WORKER} present, ${wasmCount} WASM asset(s) under public/powersync/assets.`
    );
  }
}
