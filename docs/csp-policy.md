# Content Security Policy

The Magic Lab enforces a strict Content Security Policy (CSP) to prevent XSS, data injection, and other code execution attacks.

## Implementation

CSP headers are constructed by the `buildCsp()` function in `src/lib/csp.ts` and applied per-request in `src/proxy.ts`.

### Current Policy

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://va.vercel-scripts.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://lh3.googleusercontent.com;
font-src 'self';
connect-src 'self' https://va.vercel-scripts.com https://vitals.vercel-insights.com https://*.powersync.journeyapps.com wss://*.powersync.journeyapps.com https://*.neonauth.c-2.eu-central-1.aws.neon.tech https://*.apirest.c-2.eu-central-1.aws.neon.tech;
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
| `script-src` | `'self' 'unsafe-inline'` | `unsafe-inline` required for next-themes' ThemeProvider anti-flicker script in the root layout. The root layout must stay static (no `headers()` call) so a per-request nonce cannot be passed to ThemeProvider. React's default output escaping provides XSS protection. |
| | `'wasm-unsafe-eval'` | Required by PowerSync WASM module |
| | `https://va.vercel-scripts.com` | Vercel Analytics script |
| `style-src` | `'self' 'unsafe-inline'` | Inline styles from CSS-in-JS and component libraries |
| `img-src` | `'self' data: blob:` | Same-origin images, data URIs (icons), blob URLs (uploads) |
| | `https://lh3.googleusercontent.com` | Google profile photos (social login) |
| `font-src` | `'self'` | Self-hosted Geist font |
| `connect-src` | `'self'` | API calls to same origin |
| | `https://va.vercel-scripts.com` | Vercel Analytics data |
| | `https://vitals.vercel-insights.com` | Vercel Speed Insights |
| | `https://*.powersync.journeyapps.com` | PowerSync Cloud sync (HTTPS) |
| | `wss://*.powersync.journeyapps.com` | PowerSync Cloud sync (WebSocket) |
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
}

const BASE_DIRECTIVES: CspDirectives = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", "https://va.vercel-scripts.com"],
  "connect-src": [
    "'self'",
    "https://va.vercel-scripts.com",
    "https://vitals.vercel-insights.com",
    "https://*.powersync.journeyapps.com",
    "wss://*.powersync.journeyapps.com",
    "https://*.neonauth.c-2.eu-central-1.aws.neon.tech",
    "https://*.apirest.c-2.eu-central-1.aws.neon.tech",
  ],
  // ... other directives
};

const DEV_EXTENSIONS: Partial<CspDirectives> = {
  "script-src": ["'unsafe-eval'"],
  "connect-src": ["wss://localhost:*"],
  "frame-src": ["https://local.drizzle.studio"],
};

function buildCsp(options: BuildCspOptions): string {
  const directives = options.isDev
    ? mergeDirectives(BASE_DIRECTIVES, DEV_EXTENSIONS)
    : BASE_DIRECTIVES;

  return directivesToString(directives);
}
```

### Why No Nonce?

A nonce-based CSP would be more restrictive than `'unsafe-inline'`, but the root layout's `ThemeProvider` (next-themes) injects an inline `<script>` for theme flash prevention. The root layout must stay static for marketing pages and cannot call `headers()` to read a per-request nonce. Including a nonce in the CSP would cause CSP Level 2+ browsers to ignore `'unsafe-inline'`, blocking the theme script on every page load.

XSS protection relies on React's default output escaping rather than CSP nonces.

### Environment-Aware Directives

| Source | Dev Only | Production |
|---|---|---|
| `'unsafe-eval'` (script-src) | Yes | No |
| `wss://localhost:*` (connect-src) | Yes | No |
| `https://local.drizzle.studio` (frame-src) | Yes | No |
| `https://*.powersync.journeyapps.com` (connect-src) | No | Yes |
| `wss://*.powersync.journeyapps.com` (connect-src) | No | Yes |
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

## See Also

- [architecture.md](./architecture.md) -- Security headers overview
- [local-development.md](./local-development.md) -- Dev environment differences
