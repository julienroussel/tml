import "server-only";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_RULE_ID = "send-notification";

// --- In-memory fallback (local dev / non-Vercel environments) ---

interface RateLimitEntry {
  count: number;
  reset: number;
}

const rateLimitsByUser = new Map<string, RateLimitEntry>();

function cleanupExpiredRateLimits(
  currentIdentifier: string,
  now: number
): void {
  if (rateLimitsByUser.size <= 100) {
    return;
  }
  for (const [key, entry] of rateLimitsByUser) {
    if (key !== currentIdentifier && now > entry.reset) {
      rateLimitsByUser.delete(key);
    }
  }
}

function checkRateLimitInMemory(identifier: string): boolean {
  const now = Date.now();
  let entry = rateLimitsByUser.get(identifier);
  if (entry && now > entry.reset) {
    entry = undefined;
  }
  if (!entry) {
    entry = { count: 0, reset: now + RATE_LIMIT_WINDOW_MS };
    rateLimitsByUser.set(identifier, entry);
    cleanupExpiredRateLimits(identifier, now);
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// --- Vercel WAF (cached dynamic import) ---

let vercelFirewall: typeof import("@vercel/firewall") | undefined;

// --- Public API ---

/**
 * Returns `true` if the request should be rate-limited (i.e. rejected).
 *
 * On Vercel: delegates to the Vercel WAF via `@vercel/firewall`.
 * Requires a matching WAF rule with Rate Limit ID `send-notification`
 * configured in the Vercel Firewall dashboard.
 * Locally / in tests: uses an in-memory fixed-window fallback.
 */
export async function checkRateLimit(identifier: string): Promise<boolean> {
  if (!process.env.VERCEL) {
    return checkRateLimitInMemory(identifier);
  }

  try {
    vercelFirewall ??= await import("@vercel/firewall");
    const { rateLimited } = await vercelFirewall.checkRateLimit(
      RATE_LIMIT_RULE_ID,
      { rateLimitKey: identifier }
    );
    return rateLimited;
  } catch (error: unknown) {
    console.error(
      "Vercel rate limit check failed, falling back to in-memory:",
      error
    );
    return checkRateLimitInMemory(identifier);
  }
}
