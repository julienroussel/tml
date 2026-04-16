# Route Structure

The Magic Lab uses Next.js App Router with route groups to separate public marketing pages from the authenticated application.

## Route Group Pattern

```
src/app/
  (marketing)/[locale]/    # Public, SEO-optimized, statically generated (7 locales)
  (app)/                   # Authenticated application (dynamic)
  auth/                    # Auth pages (dynamic, locale-aware via cookie)
```

### Why Route Groups?

- **Separate layouts**: Marketing pages use a minimal layout (no sidebar). The app uses a full sidebar + header layout.
- **Auth boundaries**: The proxy (`src/proxy.ts`) redirects unauthenticated users away from `(app)/` routes.
- **SEO isolation**: Marketing pages have full metadata, Open Graph tags, structured data, and hreflang alternates. App pages use `noindex`.
- **Static generation**: Marketing pages are statically generated at build time. Auth and app pages are server-rendered on demand (auth pages read the `NEXT_LOCALE` cookie for locale-aware rendering; app pages require auth).

## Full Route Tree

### Marketing Routes -- `(marketing)/[locale]/`

Marketing pages use URL-based locale routing for SEO. Each page is statically generated for all 7 locales (21 total pages). Bare paths (`/faq`, `/privacy`) are redirected by the proxy to locale-prefixed versions (e.g., `/en/faq`). The root path `/` redirects authenticated users to `/dashboard` and unauthenticated users to the locale-prefixed landing page (e.g., `/en`).

| Path | Page | Description |
|---|---|---|
| `/[locale]` | Landing page | Hero, feature grid, CTA |
| `/[locale]/faq` | FAQ | Common questions |
| `/[locale]/privacy` | Privacy policy | Data handling |

### App Routes -- `(app)/`

| Path | Page | Module | Description |
|---|---|---|---|
| `/dashboard` | Dashboard | -- | Home with module grid and quick stats |
| `/repertoire` | Repertoire | Repertoire (Library) | Trick CRUD with tags, filtering, and search |
| `/collect` | Collection | Collection (Library) | Item CRUD with tags, trick linking, filtering, and search |
| `/improve` | Improve | Improve (Lab) | Practice session logging and history |
| `/train` | Train | Train (Lab) | Goal setting, drills, streaks |
| `/plan` | Plan | Plan (Lab) | Setlist builder |
| `/perform` | Perform | Perform (Lab) | Performance logging and review |
| `/enhance` | Enhance | Enhance (Insights) | Insights, suggestions, analytics |
| `/settings` | Settings | -- | User preferences, account |
| `/admin` | Admin | Admin (Admin) | Application administration |
| `/account/[path]` | Account | -- | Neon Auth account management (sign-in, sign-up, etc.) |

### Auth Routes

| Path | Description |
|---|---|
| `/auth/[path]` | Auth pages (sign-in, sign-up) — dynamic, locale-aware. Locale toggle + theme toggle in header. Neon Auth UI localized via `auth` i18n namespace. Redirects to `/dashboard` if already authenticated |

### API Routes

| Path | Method | Description |
|---|---|---|
| `/api/auth/[...path]` | Various | Neon Auth (Better Auth) endpoints |
| `/api/email/unsubscribe` | GET | Email unsubscribe handler |

## Proxy Behavior

The proxy (`src/proxy.ts`) handles locale redirects and auth-based routing:

```
Any user
  |
  +--> visits /faq or /privacy
  |      --> 302 redirect to /[locale]/... (detected from cookie or Accept-Language)
  |
  +--> visits /en, /fr/faq, etc.
         --> Serve static page (no server computation)

Unauthenticated user
  |
  +--> visits /
  |      --> 302 redirect to /[locale] (marketing landing page)
  |
  +--> visits /dashboard, /improve, etc.
  |      --> Redirect to /auth/sign-in
  |
  +--> visits /en/faq
         --> Show static FAQ page

Authenticated user
  |
  +--> visits /
  |      --> 302 redirect to /dashboard
  |
  +--> visits /auth/sign-in, /auth/sign-up
  |      --> Redirect to /dashboard
  |
  +--> visits /dashboard, /improve, etc.
         --> Show app page
```

## Layout Hierarchy

```
RootLayout (src/app/layout.tsx)
  |-- Static shell: <html>, <body>, fonts, ServiceWorker, Analytics
  |-- No dynamic APIs, no providers (enables static descendant routes)
  |
  +-- (marketing)/[locale]/layout.tsx
  |     |-- Providers (theme, auth, i18n), skip-to-content
  |     |-- Statically generated (setRequestLocale + force-static)
  |     +-- page.tsx (landing)
  |     +-- faq/page.tsx
  |     +-- privacy/page.tsx
  |
  +-- (app)/layout.tsx
  |     |-- Providers with locale from cookies/headers
  |     |-- Dynamic (auth.getSession)
  |     +-- dashboard/page.tsx
  |     +-- improve/page.tsx
  |     +-- ...
  |
  +-- auth/layout.tsx
  |     |-- Providers (dynamic, locale from NEXT_LOCALE cookie)
  |     |-- DynamicIntlProvider > NeonAuthLocalizedProvider > children
  |     +-- auth/[path]/page.tsx (Neon Auth UI, localized)
  |
  +-- account/[path]/page.tsx (Neon Auth account management)
```

## See Also

- [architecture.md](./architecture.md) -- Overall architecture
- [auth-flow.md](./auth-flow.md) -- Authentication and route protection
- [diagrams/route-map.md](./diagrams/route-map.md) -- Visual route map
