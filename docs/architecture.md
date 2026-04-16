# Architecture Overview

The Magic Lab is a free, open-source progressive web application (PWA) for magicians, built with an offline-first architecture.

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Framework | Next.js 16 (App Router) | Server/client rendering, routing, API routes |
| UI Library | React 19 + React Compiler | Automatic memoization, concurrent features |
| Styling | Tailwind CSS v4 + shadcn/ui | Utility-first CSS, accessible component primitives |
| Database | Neon Postgres | Serverless Postgres with branching |
| ORM | Drizzle ORM | Type-safe SQL queries, migrations |
| Sync Engine | PowerSync Cloud | Offline-first with local WASM SQLite |
| Auth | Neon Auth (Better Auth) | Google OAuth, email OTP, session management |
| Hosting | Vercel | Edge deployment, automatic CI/CD |
| Analytics | Vercel Analytics + Speed Insights | Page views, Core Web Vitals |
| Notifications | web-push + Resend | Push notifications, email fallback |
| i18n | next-intl | 7-locale internationalization |

## App Router Structure

The application uses Next.js route groups to separate public marketing pages from the authenticated app experience:

```
src/app/
  (marketing)/          # Public SEO-optimized pages
    page.tsx            # Landing / hero page
    ...
  (app)/                # Authenticated application
    layout.tsx          # Sidebar + header chrome
    dashboard/page.tsx  # Home dashboard
    repertoire/page.tsx # Trick library (Library module)
    collect/page.tsx    # Inventory management (Library module) — enabled
    improve/page.tsx    # Practice session logging (Lab module)
    train/page.tsx      # Goal setting and drills (Lab module)
    plan/page.tsx       # Setlist builder (Lab module)
    perform/page.tsx    # Performance tracking (Lab module)
    enhance/page.tsx    # Insights and suggestions (Insights module)
    settings/page.tsx   # User preferences
    admin/page.tsx      # Admin panel (Admin module)
  layout.tsx            # Root layout (theme, fonts, analytics)
  api/                  # API routes
```

See [route-structure.md](./route-structure.md) for the complete route tree.

## Feature Modules

Each feature area is organized as a self-contained module defined in `src/lib/modules.ts`. Modules declare their slug, label, description, icon, enabled state, and group. The module registry drives both the sidebar navigation and the marketing feature grid. Use `getModulesByGroup(group)` to retrieve modules for a specific group.

Modules are organized into 4 groups:

- **Library**: Repertoire (enabled), Collection (enabled)
- **Lab**: Improve, Train, Plan, Perform
- **Insights**: Enhance
- **Admin**: Admin

See [diagrams/module-deps.md](./diagrams/module-deps.md) for feature module dependencies.

## Rendering Strategy

- **Server Components** (default) for data fetching and static content
- **Client Components** (`"use client"`) for interactive UI, form state, and PowerSync queries
- **React Compiler** enabled globally (`reactCompiler: true` in `next.config.ts`) for automatic memoization -- no manual `useMemo`/`useCallback` needed

## Content Security Policy

CSP headers are set in `next.config.ts` via the `headers()` function:

- `default-src 'self'` as the baseline
- `script-src` allows Vercel Analytics scripts and `'unsafe-inline'` (required by next-themes)
- `connect-src` allows Vercel Analytics/Insights, PowerSync Cloud, and Neon Auth/Data API endpoints
- `worker-src 'self'` for the service worker
- `object-src 'none'`, `frame-ancestors 'none'` for clickjacking prevention

See [csp-policy.md](./csp-policy.md) for the CSP builder details.

## Offline-First Architecture

The app is designed around an offline-first data model using PowerSync Cloud:

1. **Local SQLite** (WASM) runs in the browser for instant reads and writes
2. **PowerSync Cloud** handles bidirectional sync between local SQLite and Neon Postgres
3. **Soft-delete with tombstones** ensures data consistency across devices
4. **Last-Write-Wins (LWW)** conflict resolution using `updated_at` timestamps

See [sync-engine.md](./sync-engine.md) and [data-model.md](./data-model.md) for details.

## Security Headers

The following security headers are applied to all routes via `next.config.ts`:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- Content-Security-Policy (see above)

## PWA

The app ships as a Progressive Web App with:

- Web app manifest (`src/app/manifest.ts`)
- Service worker (`public/sw.js`) for push notifications
- Installable on mobile and desktop

See [pwa-notifications.md](./pwa-notifications.md) for details.
