# Authentication Flow

The Magic Lab uses Neon Auth (powered by Better Auth) for authentication and session management.

## Overview

- **Provider**: Neon Auth (Better Auth underneath)
- **Storage**: User and session data stored in the `neon_auth` schema in Neon Postgres
- **Sign-in methods**: Google OAuth, email OTP
- **Session strategy**: Database sessions with secure HTTP-only cookies

## Sign-In Methods

| Method | Use Case |
|---|---|
| Google OAuth | Primary sign-in for most users |
| Email OTP | Passwordless sign-in via one-time code |

Google uses the Authorization Code flow with PKCE. Email OTP sends a time-limited code to the user's inbox.

## Session Management

### Server Components

```typescript
import { auth } from "@/auth/server";

export default async function ProtectedPage() {
  const { data: session } = await auth.getSession();
  // session.user contains the authenticated user
}
```

`auth.getSession()` reads the session cookie, validates it against the database, and returns the user data. If the session is invalid or expired, it returns `null`.

### Client Components

```typescript
"use client";
import { authClient } from "@/auth/client";

// authClient is a Neon Auth client created with createAuthClient()
// Use authClient.getSession() for one-off session checks
// The NeonAuthUIProvider in the root layout provides auth context to the UI
```

## Route Protection (proxy.ts)

Next.js 16 uses `proxy.ts` (not `middleware.ts`) for request interception. The proxy protects all `(app)/*` routes:

```typescript
// src/proxy.ts
import { auth } from "@/auth/server";

const authMiddleware = auth.middleware({
  loginUrl: "/auth/sign-in",
});

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Redirect authenticated users away from auth pages
  if (AUTH_ROUTES.has(pathname) && request.cookies.has(SESSION_COOKIE_NAME)) {
    const { data: session } = await auth.getSession();
    if (session?.user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // Protect app routes — redirects unauthenticated users to sign-in
  return authMiddleware(request);
}

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
};
```

### Route Protection Rules

| Route Group | Auth Required | Behavior |
|---|---|---|
| `(marketing)/*` | No | Public pages, SEO-optimized |
| `(app)/*` | Yes | Redirect to `/auth/sign-in` if unauthenticated |
| `/auth/*` | No | Auth pages; redirect to `/dashboard` if already signed in |
| `/api/auth/*` | No | Auth endpoints (sign-in, callback, etc.) |
| `/api/*` (other) | Yes | Return 401 if unauthenticated |

## PowerSync Authentication

PowerSync Cloud authenticates via Neon Auth tokens. The connector (`src/sync/connector.ts`) obtains a token from the Neon Auth client and passes it to PowerSync Cloud for sync authentication. There is no separate `/api/powersync/token` endpoint — the token is fetched client-side via the auth client.

## Sign-In Flow

1. User clicks "Sign In" on the landing page
2. Neon Auth UI shows sign-in options (Google, email OTP)
3. User authenticates with chosen method
4. Neon Auth creates/updates user in `neon_auth` schema
5. Session created with secure HTTP-only cookie
6. User redirected to `/dashboard`

## Sign-Out Flow

Sign-out is handled by the Neon Auth UI component (`AccountView`) at `/account/*`. The flow:

1. User navigates to account management
2. Signs out via the Neon Auth UI
3. Session cookie cleared
4. User redirected to landing page

## Security Considerations

- Session cookies are `HttpOnly`, `Secure`, `SameSite=Lax`
- CSRF protection via Better Auth's built-in CSRF tokens
- Session rotation on privilege escalation
- Idle session timeout (configurable, default 30 days)
- All auth endpoints are rate-limited

## See Also

- [route-structure.md](./route-structure.md) -- Route protection details
- [sync-engine.md](./sync-engine.md) -- PowerSync sync architecture
