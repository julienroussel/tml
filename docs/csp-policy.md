# Content Security Policy

The Magic Lab enforces a strict Content Security Policy (CSP) to prevent XSS, data injection, and other code execution attacks.

## Implementation

CSP headers are constructed by the `buildCsp()` function in `src/lib/csp.ts` and applied per-request in `src/proxy.ts`.

### Current Policy

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'sha256-<LANG_SCRIPT>' 'sha256-<next-themes>' 'wasm-unsafe-eval' https://va.vercel-scripts.com;
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

_(Hash values abbreviated above — see `INLINE_SCRIPT_HASHES` in `src/lib/csp.ts` for actual values.)_

### Directive Breakdown

| Directive | Value | Reason |
|---|---|---|
| `default-src` | `'self'` | Baseline: only same-origin resources |
| `script-src` | `'self' 'unsafe-inline'` | `'unsafe-inline'` is kept for CSP Level 1 backward compatibility. CSP Level 2+ browsers ignore it when hash sources are present. |
| | `'sha256-...'` (x2) | SHA-256 hashes of the two inline scripts in the root layout: the locale detection script (`LANG_SCRIPT`) and the next-themes ThemeProvider anti-flicker script. Only these scripts are allowed to run inline. |
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
const INLINE_SCRIPT_HASHES = [
  "'sha256-<LANG_SCRIPT_hash>'",   // locale detection
  "'sha256-<next-themes_hash>'",   // ThemeProvider anti-flicker
] as const;

const BASE_DIRECTIVES: CspDirectives = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    ...INLINE_SCRIPT_HASHES,
    "'wasm-unsafe-eval'",
    "https://va.vercel-scripts.com",
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

### Hash-Based Inline Script Policy

The root layout contains two inline `<script>` tags:

1. **Locale detection** (`src/lib/lang-script.ts`) — sets `<html lang>` before first paint for screen readers.
2. **Theme anti-flicker** (injected by next-themes `ThemeProvider`) — applies the saved theme class before first paint to prevent a flash of the wrong theme.

Both scripts are deterministic: their content is fixed for a given set of locales and ThemeProvider configuration. Their SHA-256 hashes are listed in `INLINE_SCRIPT_HASHES` in `src/lib/csp.ts`.

**How it works:**

- CSP Level 2+ browsers see hash sources in `script-src` and **ignore** `'unsafe-inline'` — only scripts matching a listed hash are allowed to execute inline.
- CSP Level 1 browsers do not understand hash sources and fall back to `'unsafe-inline'`, which permits all inline scripts (same security as before).
- This is the CSP spec's recommended migration path from `'unsafe-inline'` to hash-based allowlisting.

**When to update hashes:**

| Event | Action |
|---|---|
| `next-themes` upgraded | Run `pnpm hash:csp` — the anti-flicker script may have changed |
| ThemeProvider props changed in `layout.tsx` | Run `pnpm hash:csp` — serialized params affect the script |
| Locale added or removed | Run `pnpm hash:csp` — LANG_SCRIPT interpolates the locales array |

The `pnpm hash:csp` command recomputes both hashes and updates `src/lib/csp.ts` in place. A test in `src/lib/csp.test.ts` verifies the hashes match the actual script content — stale hashes cause CI failure.

### Why No Nonce?

A nonce-based CSP would be even more restrictive, but the root layout must stay static for marketing page generation and cannot call `headers()` to read a per-request nonce. Hash-based allowlisting provides equivalent security for deterministic scripts without requiring dynamic rendering.

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
