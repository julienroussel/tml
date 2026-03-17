# Route Structure

The Magic Lab uses Next.js App Router with two route groups to separate public marketing pages from the authenticated application.

## Dual Route Group Pattern

```
src/app/
  (marketing)/              # Public, SEO-optimized pages
  (app)/                    # Authenticated application
```

### Why Route Groups?

- **Separate layouts**: Marketing pages use a minimal layout (no sidebar). The app uses a full sidebar + header layout.
- **Auth boundaries**: The proxy (`src/proxy.ts`) redirects unauthenticated users away from `(app)/` routes.
- **SEO isolation**: Marketing pages have full metadata, Open Graph tags, and structured data. App pages use `noindex`.

## Full Route Tree

### Marketing Routes -- `(marketing)/`

| Path | Page | Description |
|---|---|---|
| `/` | Landing page | Hero, feature grid, CTA |
| `/faq` | FAQ | Common questions |
| `/privacy` | Privacy policy | Data handling |
| `/about` | About (planned) | Project story and mission |
| `/terms` | Terms of service (planned) | Usage terms |

### App Routes -- `(app)/`

| Path | Page | Module | Description |
|---|---|---|---|
| `/dashboard` | Dashboard | -- | Home with module grid and quick stats |
| `/improve` | Improve | Improve | Practice session logging and history |
| `/train` | Train | Train | Goal setting, drills, streaks |
| `/plan` | Plan | Plan | Routine builder, setlist management |
| `/perform` | Perform | Perform | Performance logging and review |
| `/enhance` | Enhance | Enhance | Insights, suggestions, analytics |
| `/collect` | Collect | Collect | Inventory of props, books, gimmicks |
| `/settings` | Settings | -- | User preferences, account |
| `/admin` | Admin | Admin | Application administration |
| `/account/[path]` | Account | -- | Neon Auth account management (sign-in, sign-up, etc.) |

### Auth Routes

| Path | Description |
|---|---|
| `/auth/[path]` | Auth pages (sign-in, sign-up) — redirects to `/dashboard` if already authenticated |

### API Routes

| Path | Method | Description |
|---|---|---|
| `/api/auth/[...path]` | Various | Neon Auth (Better Auth) endpoints |
| `/api/email/unsubscribe` | GET | Email unsubscribe handler |

## Proxy Behavior

The proxy (`src/proxy.ts`) handles auth-based redirects:

```
Unauthenticated user
  |
  +--> visits /dashboard, /improve, etc.
  |      --> Redirect to /auth/sign-in
  |
  +--> visits /
         --> Show landing page

Authenticated user
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
  |-- ThemeProvider, NeonAuthUIProvider, NextIntlClientProvider, fonts, analytics
  |
  +-- (marketing)/layout.tsx
  |     |-- Minimal layout (no sidebar)
  |     +-- page.tsx (landing)
  |
  +-- (app)/layout.tsx
  |     |-- SidebarProvider + AppSidebar
  |     |-- SidebarInset + header
  |     +-- dashboard/page.tsx
  |     +-- improve/page.tsx
  |     +-- train/page.tsx
  |     +-- ...
  |
  +-- auth/[path]/page.tsx (Neon Auth UI)
  +-- account/[path]/page.tsx (Neon Auth account management)
```

## See Also

- [architecture.md](./architecture.md) -- Overall architecture
- [auth-flow.md](./auth-flow.md) -- Authentication and route protection
- [diagrams/route-map.md](./diagrams/route-map.md) -- Visual route map
