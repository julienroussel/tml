import { notFound } from "next/navigation";
import type { ReactElement } from "react";

// Block server-render in production builds entirely so the diagnostic page
// cannot leak any internal sync state via prefetch or accidental link.
export const dynamic = "force-dynamic";

// The SyncStatusDebug client component is loaded via dynamic import AFTER the
// dev-env gate (NODE_ENV + VERCEL_ENV). In production the route returns 404
// (notFound() runs before the await), so the chunk is never fetched by
// browsers. The chunk file itself
// DOES still ship to `.next/static/chunks/` — webpack/Turbopack emits a chunk
// for every `import()` site regardless of whether the call is reachable —
// but it's a static file at an unguessable hash path with no secrets in it
// (diagnostic UI strings, JWT decode logic, PowerSync table names — all of
// which are either public or trivially derivable). If you want to verify
// nothing sensitive leaks, grep `.next/static/chunks/` after `pnpm build`
// for the strings you're concerned about.
//
// Verified 2026-05-28 (commit 8af1e82): `pnpm build` emits this chunk to
// `.next/static/chunks/` as expected; a secret-marker grep of `.next/static/`
// is clean (only non-secret PowerSync SDK table names + display-only JWT decode
// ship), `__TEST_FORCE_BUCKET_HEALTH` is tree-shaken out, and `force-dynamic`
// (above) means no prerendered HTML for this route. The
// `scripts/check-bundle-secrets.ts` postbuild guard scans browser-shipped build
// output (`.next/static/` + prerendered `.next/server/`) for known
// secret-marker shapes on every build (a tripwire, not a complete secret
// detector). (#341)
export default async function SyncStatusDebugPage(): Promise<ReactElement> {
  // Defense-in-depth: 404 on both axes. `NODE_ENV === "production"` in every
  // Vercel build (prod AND preview), and `VERCEL_ENV` is set on every Vercel
  // environment (production/preview/development), so a deploy that somehow
  // ran with `NODE_ENV=development` would still be excluded by the second
  // check. CLAUDE.md → "Platform Preferences" mandates `VERCEL_ENV` for env
  // detection precisely because `NODE_ENV` cannot distinguish prod from preview.
  if (process.env.NODE_ENV !== "development" || process.env.VERCEL_ENV) {
    notFound();
  }
  const { SyncStatusDebug } = await import("./sync-status-debug");
  return <SyncStatusDebug />;
}
