/**
 * Name of a non-production-only window flag the E2E suite uses to force a
 * specific bucket-health result. Lives in its own file so the production
 * bundle of `use-bucket-health.ts` does not carry the identifier — the hook
 * inlines the string literal inside a `NODE_ENV === "production"` guard so
 * the whole branch dead-code-eliminates in production builds. The E2E spec
 * imports from here directly. Keep the string in both places in sync.
 */
export const TEST_BUCKET_HEALTH_OVERRIDE = "__TEST_FORCE_BUCKET_HEALTH";

// Single narrowing of `globalThis` to an indexable shape for the three
// override helpers below. The cast is necessary because `globalThis` is
// typed as `typeof globalThis` (no indexed signature). Centralizing it
// keeps the `as` count at one for the whole module.
const g = globalThis as Record<string, unknown>;

export function readGlobalOverride(): unknown {
  return g[TEST_BUCKET_HEALTH_OVERRIDE];
}

export function writeGlobalOverride(value: unknown): void {
  g[TEST_BUCKET_HEALTH_OVERRIDE] = value;
}

export function clearGlobalOverride(): void {
  delete g[TEST_BUCKET_HEALTH_OVERRIDE];
}
