# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

- **Tagline**: Train. Plan. Perform. Elevate your magic.
- **Description**: A personal workspace built for magicians — whether you're just starting out or performing professionally. A single place to organize your repertoire, plan your routines, track your practice sessions, and refine your performance over time.
- **Core features**: Practice logging, goal setting & drills, set/routine planning, performance tracking, continuous improvement tools, and inventory management (props, books, gimmicks, and other items).
- **Production URL**: https://themagiclab.app/
- **Hosting**: Vercel

## Commands

```bash
pnpm dev            # Start dev server (Turbopack)
pnpm build          # Production build
pnpm start          # Start production server
pnpm lint           # Lint and format check (Ultracite/Biome)
pnpm fix            # Auto-fix lint and format issues
pnpm typecheck      # TypeScript type checking (tsc -b)
pnpm test           # Run tests in watch mode (Vitest)
pnpm test:run       # Run tests once
pnpm test:coverage  # Run tests with coverage
pnpm test:ui        # Open Vitest UI
pnpm test:e2e       # Run Playwright E2E tests
pnpm test:e2e:ui    # Open Playwright UI mode
pnpm db:generate    # Generate Drizzle migration from schema changes
pnpm db:migrate     # Apply pending migrations to Neon
pnpm db:studio      # Open Drizzle Studio GUI
pnpm i18n:check     # Validate all locales have matching keys
pnpm docs:generate  # Regenerate llms.txt files from docs/
pnpm setup          # Initial project setup
```

Requires Node 24.x and pnpm >= 10.

## Architecture

### Stack

- **Next.js 16** with App Router (`src/app/`)
- **React 19** with React Compiler enabled for automatic memoization
- **TypeScript** in strict mode — path alias `@/*` → `src/*`
- **Tailwind CSS v4** via `@tailwindcss/postcss` — CSS-first config in `globals.css`
- **shadcn/ui** (new-york style) — Radix UI primitives, styled with CVA + tailwind-merge + clsx via `cn()` (`src/lib/utils.ts`)
- **Neon Auth** (`@neondatabase/auth`) — email OTP + Google social login
- **Neon Postgres** (`@neondatabase/serverless`) — serverless database
- **Drizzle ORM** — server-side schema and migrations (`src/db/`)
- **PowerSync** — offline-first sync engine, client-side SQLite (`src/sync/`)
- **Biome** via **Ultracite** — linting and formatting (no ESLint, no Prettier)
- **Vitest** + Testing Library — testing (not Jest)
- **Lefthook** — git hooks (pre-commit runs `ultracite fix` on staged files)
- **next-intl** — internationalization (7 locales)
- **next-themes** — dark mode toggling via `ThemeProvider`
- **Lucide React** — icons
- **Geist** font family (sans + mono)
- **Vercel Analytics** + **Speed Insights** — monitoring
- **PWA support** — manifest (`src/app/manifest.ts`), service worker (`public/sw.js`), push notifications (`web-push`)
- Licensed under GPL-3.0

### Route Groups

- `src/app/(app)/` — authenticated routes (dashboard, settings, feature modules). Protected by `proxy.ts`.
- `src/app/(marketing)/` — public pages (landing, FAQ, privacy). No auth required.
- `src/app/auth/` — sign-in / sign-up pages. Authenticated users are redirected to `/dashboard`.
- `src/app/api/` — API route handlers (PowerSync upload, auth, unsubscribe, etc.).

### Server Actions

- Declared with `"use server"` directive at file top.
- Always pair with `import "server-only"` to prevent client bundling.
- Auth check via `await auth.getSession()` at the start of every action.
- For non-blocking post-response work (e.g., emails), use `after()` from `next/server`. Never `setTimeout` or fire-and-forget promises in serverless.

### Module Registry

- `src/lib/modules.ts` defines all feature modules (improve, train, plan, perform, enhance, collect, admin).
- All modules are currently `enabled: false` — features are in development.
- Each module has a slug, label, description, icon, and group (`main` or `admin`).

---

## Platform Preferences

- **Prefer Vercel-native features** over third-party alternatives when Vercel offers an equivalent that meets the need and is available on the current subscription plan (e.g., Vercel WAF rate limiting over Upstash, Vercel KV over external Redis, Vercel Cron Jobs over external schedulers).
- Only suggest a third-party service if Vercel's offering is insufficient or unavailable on the current plan — explain why.
- **Environment detection**: Use `VERCEL_ENV` (not `NODE_ENV`) to distinguish production from preview/development. `NODE_ENV` is `"production"` in both production and preview deployments.

---

## Version-Specific Rules

Many patterns from older tutorials are outdated. **Never suggest or use deprecated patterns for any of these tools.**

### Next.js 16

- **`proxy.ts` not `middleware.ts`** — `middleware.ts` does not exist in Next.js 16. The proxy config export must NOT use `as const` (Turbopack can't statically parse it).
- **Async dynamic APIs** — `cookies()`, `headers()`, `params`, `searchParams` are async and must be awaited. `const { slug } = await params`.
- **React Compiler** — enabled via `reactCompiler: true` (top-level in `next.config.ts`, NOT under `experimental`). **Never use `useMemo`, `useCallback`, or `React.memo`** — the compiler handles memoization.
- **Metadata API** — use `export const metadata` or `export function generateMetadata`. Never `next/head` (doesn't exist in App Router).
- **Caching** — `fetch()` is not cached by default. Use `{ cache: 'force-cache' }` or the `"use cache"` directive. `unstable_cache` is deprecated.
- **Config** — `reactCompiler`, `devIndicators`, `serverActions` are top-level config options, not under `experimental`.

### React 19

- **`ref` is a regular prop** — never use `React.forwardRef`.
- **`use()` hook** — for reading promises and context in render.
- **`useActionState`** replaces the deprecated `useFormState`.
- **`useFormStatus`** is from `react-dom`, not `next/...`.
- **Server Actions** are stable — no `experimental.serverActions` flag.

### Tailwind CSS v4

- **No `tailwind.config.js`** — never create one. Theme is CSS-first via `@theme inline { ... }` in `globals.css`.
- **`@import "tailwindcss"`** — not `@tailwind base; @tailwind components; @tailwind utilities;`.
- **PostCSS plugin** is `@tailwindcss/postcss`, not `tailwindcss`.
- **`@custom-variant`** replaces JS `addVariant` plugins. Content detection is automatic.
- **Colors use oklch**. Tokens are CSS custom properties mapped via `@theme inline`. Never suggest `theme.extend` (JS config syntax).
- **Class renames from v3**: `shadow-sm`→`shadow-xs`, `shadow`→`shadow-sm`, `ring`→`ring-3`, `blur`→`blur-sm`, `rounded`→`rounded-sm`, `outline-none`→`outline-hidden`.

### Biome & Ultracite

- **No ESLint, no Prettier, no Stylelint** — never suggest installing them or reference their config files.
- **Commands**: `pnpm lint` (check) / `pnpm fix` (auto-fix). Not `npx eslint`, `npx prettier`, or `pnpm dlx ultracite`.
- **Import sorting** is handled by Biome's `organizeImports`.
- **`biome.json`** extends `ultracite/biome/core` and `ultracite/biome/next`.

### Vitest

- **Not Jest** — use `vi.mock()`, `vi.fn()`, `vi.spyOn()`. Never `jest.*` equivalents.
- **Config**: `vitest.config.mts`. **Setup**: `vitest.setup.ts`.
- **Imports**: `describe`, `it`, `expect` from `vitest`. Not `@jest/globals`.
- **Async tests**: use `async/await`. Never `done` callbacks.

---

## TypeScript Standards

Type safety is a first-class concern. All code must be rigorously typed.

- **Never use `any`**. Use `unknown` when the type is genuinely unknown, then narrow explicitly.
- **No loose typings**. Avoid `object`, `{}`, `Function`. Be specific.
- **Explicit return types** on exported functions and public APIs. Inferred types OK for local helpers only when unambiguous.
- **Modern type-level TypeScript**: discriminated unions, `satisfies`, `as const`, template literal types, branded types for domain IDs (`UserId`, `TrickId`).
- **Prefer `interface`** for extensible object shapes; `type` for unions, intersections, computed types.
- **Generic constraints** as narrow as possible.
- **No type assertions** (`as X`) unless unavoidable — prefer type guards and narrowing.
- **No `@ts-ignore`/`@ts-expect-error`** without explanation and tracking issue.
- **Exhaustive checks** — use `never` in switch/if to catch unhandled cases at compile time.
- **Functional style over classes**. Factory functions returning object literals, not classes with `implements`.

## Test Strategy

- **Co-located test files**: `foo.ts` → `foo.test.ts` (same directory)
- **Coverage threshold**: 80% global (statements, branches, functions, lines)
- **Test utilities** in `src/test/`:
  - `factories.ts` — `createTestTrick()`, `createTestRoutine()`, `createTestUser()` etc.
  - `mocks.ts` — `mockNextNavigation()`, `mockNextImage()`, `mockNextLink()`
  - `render.tsx` — custom render wrapper with providers
- **What NOT to test**: shadcn/ui primitives, layout wrappers, CSS, E2E flows, performance, third-party APIs
- **Mock boundaries**: Mock DB via `vi.mock`, mock PowerSync API surface, mock push/email sending

## i18n Reference

- **Library**: next-intl
- **Message files**: `src/i18n/messages/<locale>.json`
- **Locales**: `en` (default, American English), `fr` (France), `es` (Spain / Peninsular), `pt` (Portugal / European), `it`, `de`, `nl` (Netherlands)
- **Key naming**: Namespaced — `"common.save"`, `"improve.logPractice"`, `"nav.dashboard"`
- **Public pages**: Subpath routing (`/fr/train`, `/es/plan`)
- **App routes**: Locale from user preferences + cookie (no URL prefix)
- **Completeness check**: `pnpm i18n:check` validates all locales have matching keys

## Sync Engine Reference

- **CRITICAL — Offline-first is a core requirement**: The app must work fully offline after initial load. PowerSync's local SQLite database is the primary data source for all reads — network is optional. Never introduce changes that break offline functionality. In particular, the service worker (`public/sw.js`) must cache all assets required for offline boot, including PowerSync WASM binaries and web workers under `/@powersync/`. The `shouldBypass()` function must only skip live API traffic (remote sync, auth, analytics), never static assets needed for offline access.
- **Server schema**: `src/db/schema/` (Drizzle — server-side, Neon Postgres)
- **Client schema**: `src/sync/schema.ts` (PowerSync — client-side, local SQLite)
- **IMPORTANT**: When modifying the database schema, ALWAYS update both schemas
- **Write path**: Component → `execute()` → upload queue → `/api/powersync/upload` → Drizzle → Neon
- **Read path**: Neon → PowerSync Cloud → client SQLite → `useQuery()` → React component
- **Conflict resolution**: Last-write-wins with `updated_at` timestamps
- **Deletion**: Soft-delete with `deleted_at` tombstone, 30-day hard-delete cleanup
- **Connector allowlists**: New synced tables MUST be added to `SYNCED_TABLE_NAMES` and `SYNCED_COLUMNS` in `src/sync/connector.ts` — unlisted tables/columns are silently rejected
- **Mutation scoping**: The connector forces the authenticated `user_id` on all writes server-side — never trusted from the client
- **Error semantics**: 4xx responses are permanent (mutation dropped); 5xx/network errors trigger PowerSync retry

## CSP Rules

- **Builder**: `src/lib/csp.ts` — typed config object, environment-aware
- **Test after changes**: Always verify CSP doesn't block required resources
- **Dev mode**: Adds HMR WebSocket sources, Drizzle Studio frame-src
- **PowerSync**: Requires `connect-src` entry for `https://*.powersync.journeyapps.com`
- **Vercel**: Requires `connect-src` for analytics and speed insights

## Migration Workflow

1. Modify Drizzle schema in `src/db/schema/`
2. Generate migration: `pnpm db:generate`
3. Review generated SQL in `src/db/migrations/`
4. Apply migration: `pnpm db:migrate`
5. Update PowerSync client schema: `src/sync/schema.ts`
6. Run `pnpm docs:generate` to update documentation

**IMPORTANT — Single migration file rule**: The `@neondatabase/serverless` driver uses stateless HTTP requests. Each migration file runs as an independent HTTP call, so DDL changes from one migration (e.g., `ADD COLUMN`) are **not visible** to the next migration within the same `drizzle-kit migrate` run. **Never split dependent SQL across multiple migration files.** If a later statement references a column or object created earlier, it must be in the **same** migration file. Hand-written migrations (e.g., RLS policy updates) that depend on a generated migration must be appended to that migration file, not created as a separate file.

**IMPORTANT — Journal timestamps must be monotonically increasing**: Drizzle-orm only applies migrations whose `when` timestamp (in `meta/_journal.json`) is greater than the last applied migration's `created_at`. If a new entry has a lower timestamp than a previous one, it will be **silently skipped**. After generating or hand-writing a migration, verify the new entry's `when` value is strictly greater than all previous entries.

## UI/Design Conventions

- **Mobile-first**: Design for <768px first, then tablet (768-1024px), then desktop (>1024px)
- **Touch targets**: Minimum 44x44px (`min-h-11 min-w-11`) — never use button `xs` on mobile
- **Animations**: Sub-200ms, functional only. Use `motion-safe:` prefix to respect `prefers-reduced-motion`
- **Empty states**: Icon + title + description + primary CTA. Use `ModuleComingSoon` pattern
- **Loading states**: Skeleton for cold start only — offline-first means data is usually instant
- **Error states**: Error boundary with retry button
- **Mobile nav**: Bottom tab bar (<768px) — Dashboard, Improve, Plan, Perform, More
- **Desktop nav**: Sidebar (unchanged existing pattern)
- **Accent color**: Violet (oklch hue 280) — matches the theatrical nature of magic

## LLM Discovery

- **llms.txt**: `public/llms.txt` and `public/llms-full.txt` — generated from `docs/` via `pnpm docs:generate`
- **CI check**: Staleness check ensures generated files match source docs
- **Robots.txt**: Allows crawling of llms.txt files

## When Adding a New Feature

Checklist:
1. Feature dir in `src/features/<name>/` (shared `components/` and `hooks/`)
2. Server schema in `src/db/schema/<name>.ts`
3. Generate + apply migration (`pnpm db:generate && pnpm db:migrate`)
4. Update PowerSync client schema (`src/sync/schema.ts`)
5. Route(s) in `src/app/(app)/<name>/`
6. Translation keys in all 7 locale files
7. Components with empty/loading/error states
8. Tests (co-located, 80%+ coverage)
9. Update module registry in `src/lib/modules.ts`
10. Update CSP if new external service (`src/lib/csp.ts`)
11. Run `pnpm docs:generate`

## Follow-up Tracking

Review follow-ups are tracked as GitHub Issues with the `review-followup` label.
Run `gh issue list --label review-followup` to see pending items.
