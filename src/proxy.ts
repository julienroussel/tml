import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth/server";

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

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Redirect authenticated users away from auth pages (validate session, not just cookie presence)
  if (AUTH_ROUTES.has(pathname) && request.cookies.has(SESSION_COOKIE_NAME)) {
    try {
      const { data: session } = await auth.getSession();
      if (session?.user) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    } catch (error: unknown) {
      // Session check failed (network/parse error) — fall through to auth
      // middleware so the user sees the login page instead of a 500.
      console.error("Session validation failed on auth route:", error);
    }
  }

  // Protect app routes — redirects unauthenticated users to sign-in
  return authMiddleware(request);
}

// NOTE: Do NOT use `as const` here — Turbopack cannot statically parse it.
export const config = {
  matcher: [
    "/auth/:path*",
    "/dashboard/:path*",
    "/improve/:path*",
    "/train/:path*",
    "/plan/:path*",
    "/perform/:path*",
    "/enhance/:path*",
    "/collect/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/account/:path*",
  ],
} satisfies { matcher: string[] };
