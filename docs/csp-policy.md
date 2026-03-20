# Content Security Policy

The Magic Lab enforces a strict Content Security Policy (CSP) to prevent XSS, data injection, and other code execution attacks.

## Implementation

CSP headers are constructed by the `buildCsp()` function in `src/lib/csp.ts` and applied dynamically per-request in `src/proxy.ts`. Each response gets a unique nonce generated via `crypto.getRandomValues()`.

### Current Policy

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' 'nonce-<per-request>' https://va.vercel-scripts.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://lh3.googleusercontent.com;
font-src 'self';
connect-src 'self' https://va.vercel-scripts.com https://vitals.vercel-insights.com https://*.powersync.journeyapps.com https://*.neonauth.c-2.eu-central-1.aws.neon.tech https://*.apirest.c-2.eu-central-1.aws.neon.tech;
worker-src 'self';
object-src 'none';
frame-ancestors 'none';
base-uri 'self';
form-action 'self' https://*.neonauth.c-2.eu-central-1.aws.neon.tech;
upgrade-insecure-requests
```

### Directive Breakdown

| Directive | Value | Reason |
|---|---|---|
| `default-src` | `'self'` | Baseline: only same-origin resources |
| `script-src` | `'self' 'unsafe-inline' 'nonce-...'` | `unsafe-inline` kept for CSP Level 1 fallback; Level 2+ browsers ignore it when a nonce is present. Nonce passed to next-themes via ThemeProvider. |
| | `'wasm-unsafe-eval'` | Required by PowerSync WASM module |
| | `https://va.vercel-scripts.com` | Vercel Analytics script |
| `style-src` | `'self' 'unsafe-inline'` | Inline styles from CSS-in-JS and component libraries |
| `img-src` | `'self' data: blob:` | Same-origin images, data URIs (icons), blob URLs (uploads) |
| | `https://lh3.googleusercontent.com` | Google profile photos (social login) |
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
| `upgrade-insecure-requests` | _(boolean)_ | Force HTTPS for all sub-resource requests |

## CSP Builder (`src/lib/csp.ts`)

The CSP is built programmatically via a typed builder function:

```typescript
// src/lib/csp.ts
interface BuildCspOptions {
  isDev: boolean;
  nonce?: string;
}

const BASE_DIRECTIVES: CspDirectives = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", "https://va.vercel-scripts.com"],
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
  "script-src": ["'unsafe-eval'"],
  "connect-src": ["ws://localhost:*"],
  "frame-src": ["https://local.drizzle.studio"],
};

function buildCsp(options: BuildCspOptions): string {
  let directives = options.isDev
    ? mergeDirectives(BASE_DIRECTIVES, DEV_EXTENSIONS)
    : BASE_DIRECTIVES;

  if (options.nonce !== undefined) {
    directives = applyNonce(directives, options.nonce);
  }

  return directivesToString(directives);
}
```

The `applyNonce` helper appends `'nonce-<value>'` to `script-src`. The existing `'unsafe-inline'` is retained for CSP Level 1 fallback — CSP Level 2+ browsers automatically ignore it when a nonce source is present.

### Environment-Aware Directives

| Source | Dev Only | Production |
|---|---|---|
| `'unsafe-eval'` (script-src) | Yes | No |
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

## Nonce-Based CSP

Nonce-based CSP is implemented. Each request gets a unique 128-bit nonce generated in `proxy.ts`:

1. `proxy.ts` generates a nonce via `crypto.getRandomValues()` and calls `buildCsp({ isDev, nonce })`
2. The nonce is forwarded to server components via the `x-nonce` request header
3. `script-src` includes `'nonce-<value>'` — CSP Level 2+ browsers use the nonce and ignore `'unsafe-inline'`
4. `'unsafe-inline'` is retained in `script-src` as a CSP Level 1 fallback
5. `'unsafe-inline'` remains in `style-src` (required by component libraries)

## See Also

- [architecture.md](./architecture.md) -- Security headers overview
- [local-development.md](./local-development.md) -- Dev environment differences
