# Content Security Policy

The Magic Lab enforces a strict Content Security Policy (CSP) to prevent XSS, data injection, and other code execution attacks.

## Implementation

CSP headers are constructed by the `buildCsp()` function in `src/lib/csp.ts` and applied to all routes via `next.config.ts`.

### Current Policy

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self' https://va.vercel-scripts.com https://vitals.vercel-insights.com https://*.powersync.journeyapps.com https://*.neonauth.c-2.eu-central-1.aws.neon.tech https://*.apirest.c-2.eu-central-1.aws.neon.tech;
worker-src 'self';
object-src 'none';
frame-ancestors 'none';
base-uri 'self';
form-action 'self' https://*.neonauth.c-2.eu-central-1.aws.neon.tech
```

### Directive Breakdown

| Directive | Value | Reason |
|---|---|---|
| `default-src` | `'self'` | Baseline: only same-origin resources |
| `script-src` | `'self' 'unsafe-inline'` | `unsafe-inline` required by next-themes for FOUC prevention |
| | `https://va.vercel-scripts.com` | Vercel Analytics script |
| `style-src` | `'self' 'unsafe-inline'` | Inline styles from CSS-in-JS and component libraries |
| `img-src` | `'self' data: blob:` | Same-origin images, data URIs (icons), blob URLs (uploads) |
| `font-src` | `'self'` | Self-hosted Geist font |
| `connect-src` | `'self'` | API calls to same origin |
| | `https://va.vercel-scripts.com` | Vercel Analytics data |
| | `https://vitals.vercel-insights.com` | Vercel Speed Insights |
| | `https://*.powersync.journeyapps.com` | PowerSync Cloud sync |
| | `https://*.neonauth.c-2.eu-central-1.aws.neon.tech` | Neon Auth endpoints |
| | `https://*.apirest.c-2.eu-central-1.aws.neon.tech` | Neon Data API |
| `worker-src` | `'self'` | Service worker |
| `object-src` | `'none'` | Block plugins (Flash, Java) |
| `frame-ancestors` | `'none'` | Prevent framing (clickjacking) |
| `base-uri` | `'self'` | Prevent base tag hijacking |
| `form-action` | `'self'` + Neon Auth | Restrict form submissions to same origin and Neon Auth |

## CSP Builder (`src/lib/csp.ts`)

The CSP is built programmatically via a typed builder function:

```typescript
// src/lib/csp.ts
const BASE_DIRECTIVES: CspDirectives = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'", "https://va.vercel-scripts.com"],
  "connect-src": [
    "'self'",
    "https://va.vercel-scripts.com",
    "https://vitals.vercel-insights.com",
    "https://*.powersync.journeyapps.com",
    "https://*.neonauth.c-2.eu-central-1.aws.neon.tech",
    "https://*.apirest.c-2.eu-central-1.aws.neon.tech",
  ],
  // ... other directives
};

const DEV_EXTENSIONS: Partial<CspDirectives> = {
  "connect-src": ["ws://localhost:*"],
  "frame-src": ["https://local.drizzle.studio"],
};

function buildCsp(isDev: boolean): string {
  const directives = isDev
    ? mergeDirectives(BASE_DIRECTIVES, DEV_EXTENSIONS)
    : BASE_DIRECTIVES;
  return directivesToString(directives);
}
```

### Environment-Aware Directives

| Source | Dev Only | Production |
|---|---|---|
| `ws://localhost:*` (connect-src) | Yes | No |
| `https://local.drizzle.studio` (frame-src) | Yes | No |
| `https://*.powersync.journeyapps.com` (connect-src) | No | Yes |
| `https://*.neonauth.c-2.eu-central-1.aws.neon.tech` (connect-src) | No | Yes |
| `https://*.apirest.c-2.eu-central-1.aws.neon.tech` (connect-src) | No | Yes |
| `https://va.vercel-scripts.com` (script/connect) | No | Yes |
| `https://vitals.vercel-insights.com` (connect-src) | No | Yes |

### Benefits of the Builder

- **Type-safe**: TypeScript ensures all directives are valid
- **Environment-aware**: Dev mode automatically adds HMR WebSocket and Drizzle Studio sources
- **Testable**: Pure function that can be unit tested
- **Maintainable**: Adding a new service means adding one line, not editing a long string

## Service Worker CSP

The service worker (`/sw.js`) has its own restrictive CSP:

```
default-src 'self';
script-src 'self'
```

This prevents the service worker from loading any external scripts.

## Nonce-Based CSP (Future)

The current `'unsafe-inline'` in `script-src` is a known weakness. The planned migration path:

1. Implement nonce-based CSP via Next.js middleware
2. Pass nonce to next-themes via a custom script injection
3. Remove `'unsafe-inline'` from `script-src`
4. Keep `'unsafe-inline'` in `style-src` (required by many component libraries)

## See Also

- [architecture.md](./architecture.md) -- Security headers overview
- [local-development.md](./local-development.md) -- Dev environment differences
