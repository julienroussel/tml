import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth/server";
import { buildCsp } from "@/lib/csp";

/**
 * Session cookie name set by Neon Auth (Better Auth under the hood).
 * Coupled to the auth provider's internals — update here if the provider
 * changes its cookie naming convention.
 */
const SESSION_COOKIE_NAME = "__Secure-neon-auth.session_token";

const authMiddleware = auth.middleware({
  loginUrl: "/auth/sign-in",
});

/** Auth routes where authenticated users should be redirected to /dashboard */
const AUTH_ROUTES = new Set(["/auth/sign-in", "/auth/sign-up"]);

/** Route prefixes that require authentication */
const PROTECTED_PREFIXES = [
  "/auth",
  "/dashboard",
  "/improve",
  "/train",
  "/plan",
  "/perform",
  "/enhance",
  "/collect",
  "/settings",
  "/admin",
  "/account",
];

// NODE_ENV is intentionally used instead of VERCEL_ENV here — CSP dev
// extensions (HMR WebSocket, Drizzle Studio frame-src) should only apply
// during local development, not in Vercel preview deployments.
const isDev = process.env.NODE_ENV === "development";

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function needsAuth(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const nonce = generateNonce();
  const csp = buildCsp({ isDev, nonce });

  // Forward nonce to server components via request header
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  // Redirect authenticated users away from auth pages (validate session, not just cookie presence)
  if (AUTH_ROUTES.has(pathname) && request.cookies.has(SESSION_COOKIE_NAME)) {
    try {
      // auth.getSession() reads cookies/headers from Next.js async storage,
      // which is available because the proxy runs within the request lifecycle.
      const { data: session } = await auth.getSession();
      if (session?.user) {
        const response = NextResponse.redirect(
          new URL("/dashboard", request.url)
        );
        response.headers.set("Content-Security-Policy", csp);
        return response;
      }
    } catch (error: unknown) {
      // Session check failed (network/parse error) — fall through to auth
      // middleware so the user sees the login page instead of a 500.
      console.error("Session validation failed on auth route:", error);
    }
  }

  // Protected routes: run auth middleware, then apply nonce + CSP
  if (needsAuth(pathname)) {
    let authResponse: NextResponse;
    try {
      authResponse = await authMiddleware(request);
    } catch (error: unknown) {
      console.error("Auth middleware threw unexpectedly:", error);
      const response = NextResponse.redirect(
        new URL("/auth/sign-in", request.url)
      );
      response.headers.set("Content-Security-Policy", csp);
      return response;
    }

    // Auth middleware redirected (unauthenticated) — return redirect with CSP
    if (
      authResponse.status >= 300 &&
      authResponse.status < 400 &&
      authResponse.headers.has("location")
    ) {
      authResponse.headers.set("Content-Security-Policy", csp);
      return authResponse;
    }

    // Auth middleware returned an error — forward it with CSP headers
    if (authResponse.status >= 400) {
      authResponse.headers.set("Content-Security-Policy", csp);
      return authResponse;
    }

    // Auth passed — create new response with nonce in request headers
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set("Content-Security-Policy", csp);

    // Carry over any cookies set by auth middleware
    for (const cookie of authResponse.cookies.getAll()) {
      response.cookies.set(cookie);
    }

    return response;
  }

  // Public routes: just apply nonce + CSP
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

// NOTE: Do NOT use `as const` here — Turbopack cannot statically parse it.
// Match all page routes, excluding static assets and the service worker
// (sw.js has its own strict static CSP in next.config.ts).
// API routes (api/) are intentionally excluded — they return JSON, not HTML,
// so CSP headers are unnecessary and auth is handled per-route.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/|favicon\\.ico|sitemap\\.xml|robots\\.txt|manifest\\.webmanifest|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot)).*)",
  ],
} satisfies { matcher: string[] };
