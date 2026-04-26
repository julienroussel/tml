# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project

- **Tagline**: Train. Plan. Perform. Elevate your magic.
- **Description**: A personal workspace for magicians — organize repertoire, plan setlists, track practice, refine performance over time.
- **Core features**: Repertoire (trick CRUD + tags), practice logging, goals & drills, setlist planning, performance tracking, continuous improvement, inventory (props, books, gimmicks).
- **Production URL**: https://themagiclab.app/
- **Hosting**: Vercel. Licensed GPL-3.0.

## Verify Before Cite — Anti-Hallucination Protocol

Before asserting any factual claim about this repo, verify it. "Remembered from training data" is never sufficient.

- **File path, symbol, or API signature** → check with `mcp__codebase-memory-mcp__search_graph` / `get_code_snippet` first; fall back to `Grep` or `Read`. Do not paraphrase from memory.
- **Library availability or version** → read `package.json`. Already installed and easy to miss: `resend`, `@react-email/render` + `react-email`, `sonner`, `cmdk`, `@vercel/firewall`, `@journeyapps/wa-sqlite`, `culori`, `radix-ui` (single umbrella package — not `@radix-ui/react-*`), `@hookform/resolvers` + `react-hook-form`, `drizzle-zod`, `zod`, `web-push`. Reach for these before suggesting alternatives.
- **Version-sensitive API** → re-read `## Version-Specific Rules` below, then confirm the installed version in `package.json` before quoting any syntax.
- **HTML / CSP / SSR output shape** → run `pnpm build` and inspect real output. Source-level reasoning has missed production realities before (memory: `feedback_verify_against_real_build.md`).
- **Tool / MCP existence** → never call `mcp__foo__bar` or assert a slash command exists without confirming its schema is in the current `<functions>` block (or load via `ToolSearch` first). `InputValidationError` follows otherwise.
- **Memory recall vs current state** → if a memory entry cites a file path, symbol, branch, or version, grep/read it before acting. The "X days old" reminder tells you the snapshot age — newer snapshots ≠ current truth.
- **"Why does X behave that way?" answers** → cite `file:line` (use `mcp__codebase-memory-mcp__get_code_snippet` or `Read`). Don't paraphrase from training data.
- **"Done" claim on non-trivial work** → call `advisor()` before declaring complete. Cheap validation (sync drift, i18n drift, migration journal monotonicity) runs automatically in the Stop hook; code-level correctness is still yours.

## Tools & Skills

Surface area available in this repo. Reach for these before hand-rolling.

### MCP servers (configured in `.mcp.json` + global)

| Namespace | Use for |
|---|---|
| `mcp__codebase-memory-mcp__*` | Code discovery — `search_graph`, `get_code_snippet`, `trace_path`, `query_graph`, `get_architecture`. **First grep per session is gated to this** (see `~/.claude/hooks/cbm-code-discovery-gate`). Fall back to `Grep`/`Read` only for non-code text. |
| `mcp__neon__*` | Neon Postgres — list/describe projects, run SQL, prepare migrations, query tuning. Use for schema introspection over `psql`. |
| `mcp__shadcn__*` | shadcn registry — `list_items_in_registries`, `view_items_in_registries`, `get_add_command_for_items`. Use before adding any UI primitive. |
| `mcp__next-devtools__*` | Next.js docs lookup, dev-time browser eval, framework upgrade helpers. |
| `mcp__docs__*` | PowerSync docs (HTTP MCP). Use for sync-rules / connector questions. |

### Slash commands

Project-level (in `.claude/commands/`):

- `/verify` — full validation suite (`lint` + `typecheck` + `test:run` + `sync:check` + `i18n:check`) in parallel. Run before declaring done on non-trivial work.
- `/real-build-check` — `pnpm build` + inspect actual `.next/server/app/**/*.html`. Use **before** planning anything CSP/HTML/SSR-shape-dependent.
- `/stale-check` — audit CLAUDE.md claims against repo state.
- `/memory <topic>` — grep memory files and print bodies inline (faster than re-reading every entry).
- `/why <path>` — git log + memory entries for a file.

User-level skills (available globally):

- `/ship` — bundled commit + PR + CI watch + merge.

### Skill-backed workflows (in `.claude/skills/`)

- **`/migrations`** — full schema-change workflow (Drizzle → review SQL → migrate → sync codegen → docs). Use this, never hand-roll.
- **`/new-feature`** — scaffolds feature dir, schema, migration, sync artifacts, route, translations, components (empty/loading/error states), tests, module registry, CSP, docs.
- **`/sync-engine`** — diff Drizzle vs PowerSync schemas; detect drift.
- **`/i18n`** — add translation keys across all 7 locales (handles ICU plurals + completeness).
- **`/shadcn`** — adding/composing shadcn components.
- **`/powersync`** — sync rules / connector / offline patterns guidance.
- **`/next-best-practices`** — App Router conventions.
- **`/ultracite`** — Biome+Ultracite lint/format troubleshooting.
- **`/notifications`** — push notification system.
- **`/neon-*`** — `neon-auth`, `neon-drizzle`, `neon-serverless`, `neon-toolkit`, `neon-js`, `add-neon-docs`.

Run `ls .claude/skills/` for the full list.

## Commands

Full script list: `pnpm run`. Project-specific gotchas:

```bash
pnpm sync:generate    # REQUIRED after any src/db/schema/** change — regenerates PowerSync artifacts
pnpm sync:check       # Fail if sync artifacts drift (pre-commit + CI gate)
pnpm i18n:check       # Validate all 7 locales share the same keys
pnpm docs:generate    # Regenerate public/llms{,-full}.txt + docs/diagrams/
```

Requires Node 24.x and pnpm ≥ 10.

## Architecture

### Stack

Pinned versions in `package.json`. Opinionated choices that aren't obvious from the lockfile:

- **shadcn/ui (new-york style)** built on the umbrella `radix-ui` package — never `@radix-ui/react-*` subpackages.
- **PowerSync direction**: offline-first SQLite is the **primary read source**; Neon is downstream. Don't bypass.
- **Sync codegen**: `src/sync/schema.ts` and `powersync/sync-config.yaml` are **generated** from Drizzle. Never hand-edit.
- **Style utility**: `cn()` in `src/lib/utils.ts` (CVA + clsx + tailwind-merge). Use for every conditional-class case.
- **Lefthook** (not Husky) for pre-commit; **Vitest** (not Jest); **Biome via Ultracite** (no ESLint/Prettier).

### Route Groups

- `src/app/(app)/` — authenticated routes (dashboard, repertoire, collect, settings, account, feature modules). Protected by `proxy.ts`. Dynamic. `/repertoire` and `/collect` are enabled Library modules; other feature routes exist but their modules are `enabled: false` until launch. `/account/[path]` uses `AccountView` from Neon Auth.
- `src/app/(marketing)/[locale]/` — public pages (landing, FAQ, privacy). URL-based locale routing, `generateStaticParams` for all 7 locales (21 pages). Bare paths (`/faq`, `/privacy`) are 302-redirected by `proxy.ts` to locale-prefixed. `/` redirects authed users to `/dashboard`, others to `/<locale>` landing.
- `src/app/auth/` — sign-in / sign-up. Dynamic (reads `NEXT_LOCALE` cookie). Authed users → `/dashboard`.
- `src/app/api/` — route handlers (PowerSync upload, auth, unsubscribe, etc.).

### Server Actions

- `"use server"` at file top + `import "server-only"` to block client bundling.
- `await auth.getSession()` at the top of every action.
- Non-blocking post-response work → `after()` from `next/server`. Never `setTimeout`/fire-and-forget in serverless.

### Module Registry

`src/lib/modules.ts` — 4 groups (`MODULE_GROUPS`):
- **Library**: Repertoire (enabled), Collection (slug `collect`, enabled)
- **Lab**: Improve, Train, Plan, Perform (all disabled)
- **Insights**: Enhance (disabled)
- **Admin**: Admin (disabled)

Use `getModulesByGroup(group)`.

### Key Directories

- **`scripts/`** — codegen and ops CLIs: `generate-sync.ts`, `check-sync.ts`, `check-i18n.ts`, `generate-docs.ts`, `generate-screenshots.ts`, `powersync.ts`, `setup.ts`. Entry points behind the `pnpm sync:*`, `pnpm i18n:check`, `pnpm docs:generate`, `pnpm screenshots` scripts.
- **`src/features/<name>/`** — active feature modules with `components/` and `hooks/`: `collect`, `enhance`, `improve`, `perform`, `plan`, `repertoire`, `settings`, `train`.
- **`src/test/`** — `factories.ts`, `mocks.tsx`, `render.tsx`, `error-boundary.tsx`.
- **`.claude/audit-*.{json,md}`, `review-baseline.json`, `review-profile.json`** — outputs of the `review-swarm` multi-reviewer audit flow. The baseline caches fresh lint/typecheck/test status for 10 minutes.

---

## Platform Preferences

- **Prefer Vercel-native features** over third-party when available on the current plan (Vercel WAF rate limiting over Upstash, Vercel KV over external Redis, Vercel Cron over external schedulers). Justify any third-party choice by why Vercel's offering is insufficient.
- **Environment detection** → `VERCEL_ENV` (not `NODE_ENV`). `NODE_ENV` is `"production"` in both prod and preview deployments.

---

## Version-Specific Rules

Never suggest or use deprecated patterns for any of these.

### Next.js 16

- **`proxy.ts` not `middleware.ts`** — `middleware.ts` does not exist in Next.js 16. Proxy config export must NOT use `as const` (Turbopack can't statically parse it).
- **Async dynamic APIs** — `cookies()`, `headers()`, `params`, `searchParams` are async and must be awaited. `const { slug } = await params`.
- **React Compiler** — `reactCompiler: true` at top level in `next.config.ts` (NOT under `experimental`). Never write `useMemo`, `useCallback`, or `React.memo` — the compiler handles it.
- **Metadata API** — `export const metadata` / `generateMetadata`. Never `next/head` (doesn't exist in App Router).
- **Caching** — `fetch()` is not cached by default. Use `{ cache: 'force-cache' }` or the `"use cache"` directive. `unstable_cache` is deprecated.
- **Config** — `reactCompiler`, `devIndicators`, `serverActions` are top-level, not under `experimental`.

### React 19

- **`ref` is a regular prop** — never use `React.forwardRef`.
- **`use()` hook** — read promises and context in render.
- **`useActionState`** replaces deprecated `useFormState`.
- **`useFormStatus`** is from `react-dom`, not `next/...`.
- **Server Actions** are stable — no `experimental.serverActions` flag.

### Tailwind CSS v4

- **No `tailwind.config.js`** — theme is CSS-first via `@theme inline { ... }` in `globals.css`.
- **`@import "tailwindcss"`** — not `@tailwind base/components/utilities`.
- **PostCSS plugin** is `@tailwindcss/postcss`.
- **`@custom-variant`** replaces JS `addVariant` plugins. Content detection is automatic.
- **Colors use oklch**. Tokens are CSS custom properties mapped via `@theme inline`. Never `theme.extend`.
- **Class renames from v3** (apply mechanically when porting): `shadow-sm`→`shadow-xs`, `shadow`→`shadow-sm`, `ring`→`ring-3`, `blur`→`blur-sm`, `rounded`→`rounded-sm`, `outline-none`→`outline-hidden`.

### Biome & Ultracite

- **No ESLint, no Prettier, no Stylelint** — never suggest installing or reference their configs.
- **Commands**: `pnpm lint` / `pnpm fix`. Not `npx eslint`, `npx prettier`, or `pnpm dlx ultracite`.
- **Import sorting** is handled by Biome's `organizeImports`.
- **`biome.json`** extends `ultracite/biome/core` and `ultracite/biome/next`.

### Vitest

- **Not Jest** — `vi.mock()`, `vi.fn()`, `vi.spyOn()`. Never `jest.*`.
- **Config**: `vitest.config.mts`. **Setup**: `vitest.setup.ts`.
- **Imports**: `describe`, `it`, `expect` from `vitest`. Not `@jest/globals`.
- **Async tests**: `async/await`. Never `done` callbacks.

---

## TypeScript Standards

- **No `any`**. Use `unknown` and narrow explicitly.
- **No loose typings** — avoid `object`, `{}`, `Function`.
- **Explicit return types** on exported functions and public APIs. Inferred OK for local helpers when unambiguous.
- **Modern type-level TS**: discriminated unions, `satisfies`, `as const`, template literal types, branded types for domain IDs (`UserId`, `TrickId`).
- **`interface`** for extensible object shapes; **`type`** for unions/intersections/computed.
- **Generic constraints** as narrow as possible.
- **No type assertions** (`as X`) unless unavoidable — prefer type guards.
- **No `@ts-ignore` / `@ts-expect-error`** without an explanation and tracking issue.
- **Exhaustive checks** — `never` in switch/if to catch unhandled cases at compile time.
- **Functional style over classes**. Factory functions returning object literals.

## Code Quality Standards

These complement Biome — they cover what the linter cannot enforce.

- **Business logic correctness** — Biome can't validate algorithms or domain rules.
- **Meaningful naming** — descriptive names for functions, variables, types, files.
- **Architecture decisions** — component boundaries, data flow, API shape.
- **Edge cases** — boundary conditions, empty/null/error states, race conditions.
- **Accessibility** — semantic HTML, ARIA, keyboard nav, screen reader support.
- **Security** — validate user input, avoid `dangerouslySetInnerHTML`, sanitize at system boundaries.
- **Early returns** to reduce nesting; extract complex conditions into named booleans.
- **Throw `Error` objects** with descriptive messages — never strings; never catch just to rethrow unchanged.
- **Tests**: assertions inside `it()`/`test()`; no committed `.only`/`.skip`; flat `describe` nesting.

## Test Strategy

- **Co-located**: `foo.ts` → `foo.test.ts`.
- **Coverage threshold**: 80% global (statements/branches/functions/lines).
- **Test utilities** in `src/test/`: `factories.ts`, `mocks.tsx`, `render.tsx`, `error-boundary.tsx`.
- **Don't test**: shadcn/ui primitives, layout wrappers, CSS, E2E flows, performance, third-party APIs.
- **Mock boundaries**: DB via `vi.mock`, PowerSync API surface, push/email sending.

## i18n Reference

- **Library**: next-intl. **Messages**: `src/i18n/messages/<locale>.json`.
- **Locales**: `en` (default, American), `fr` (France), `es` (Spain / Peninsular), `pt` (Portugal / European), `it`, `de`, `nl` (Netherlands).
- **Key naming**: namespaced — `common.save`, `improve.logPractice`, `nav.dashboard`, `auth.SIGN_IN`.
- **Auth namespace** (`auth.*`) — UPPER_SNAKE_CASE to match `AuthLocalization` from `@neondatabase/auth`. Extracted by `src/i18n/auth-localization.ts` and passed via `NeonAuthLocalizedProvider`.
- **Email namespace** (`email.*`) — camelCase with simple `{name}` placeholders (not ICU). Loaded server-side by `src/i18n/email-translations.ts` via `getEmailTranslations(locale)` — runs outside next-intl context (no `useTranslations`). Falls back to default locale on incomplete translations.
- **Marketing**: URL-based locale routing. Bare paths redirect via proxy. Statically generated.
- **Auth pages & App routes**: locale from `NEXT_LOCALE` cookie (no URL prefix). Dynamic.
- **Completeness check**: `pnpm i18n:check`.

## Sync Engine Reference

**CRITICAL — Offline-first is a load-bearing requirement.** App must boot and operate with no network after first load. PowerSync's local SQLite is the primary read source. The service worker (`public/sw.js`) must cache PowerSync WASM + workers under `/@powersync/`; `shouldBypass()` skips only live API traffic (sync/auth/analytics), never static assets.

| Layer | Path | Status |
|---|---|---|
| Server schema | `src/db/schema/` (Drizzle, Neon) | **source of truth** |
| Client schema | `src/sync/schema.ts` | generated |
| Sync config | `powersync/sync-config.yaml` (Streams edition 3) | generated |
| Column allowlist | `src/sync/synced-columns.ts` | generated |

- **Write path**: Component → `execute()` → upload queue → `/api/powersync/upload` → Drizzle → Neon.
- **Read path**: Neon → PowerSync Cloud → client SQLite → `useQuery()` → React.
- **Conflict resolution**: last-write-wins on `updated_at`.
- **Deletion**: soft-delete with `deleted_at`, 30-day hard-delete cleanup.
- **Mutation scoping**: connector forces authenticated `user_id` server-side — never trust from client.
- **Error semantics**: 4xx = permanent (mutation dropped); 5xx/network = retry.

### Sync Config Codegen

Generated by `scripts/generate-sync.ts` from the Drizzle schema. **Never hand-edit** the generated artifacts.

- Run `pnpm sync:generate` after any change under `src/db/schema/**`.
- `pnpm sync:check` runs in pre-commit (Lefthook) and CI.
- Server-only tables (`users`, `user_preferences`, `push_subscriptions`) are in `SERVER_ONLY_TABLES` in `scripts/generate-sync.ts`. Tables sync by default — add to denylist only if a table must never reach the client.
- Generator fails fast on unknown Drizzle `columnType`. Add a mapping in `mapColumnType` when that happens.

### Sync Config Deployment

Deployed via the PowerSync CLI from GitHub Actions.

- **Workflow**: `.github/workflows/deploy-sync.yml` runs on push to `main` when sync-config.yaml or Drizzle schema changes. Calls `pnpm sync:validate` then `pnpm sync:deploy`.
- **Manual deploy**: `POWERSYNC_ADMIN_TOKEN=... POWERSYNC_INSTANCE_ID=... POWERSYNC_PROJECT_ID=... pnpm sync:deploy`. **Do not paste the PAT inline** — it lands in `~/.zsh_history` / `~/.bash_history` unencrypted. Prefer `direnv` (`.envrc` excluded from git), `op run --env-file=.env.sync -- pnpm sync:deploy`, or prefix with a leading space when `HISTCONTROL=ignorespace` is set.
- **Credentials** (all `POWERSYNC_*`-prefixed — thin `scripts/powersync.ts` wrapper maps to CLI's bare names):
  - `POWERSYNC_ADMIN_TOKEN` — GitHub **secret**, PAT from https://dashboard.powersync.com/account/access-tokens.
  - `POWERSYNC_INSTANCE_ID` / `POWERSYNC_PROJECT_ID` — GitHub repository **variables** (not secrets; visible in logs). Discover via `powersync fetch instances --output=json`.
  - `POWERSYNC_ORG_ID` — only if the PAT spans multiple orgs.
- **Rollback**: revert the commit and re-run. No native CLI rollback.
- **Dashboard is view-only** — never edit sync rules there. Changes must flow through PR.

## CSP Rules

- **Builder**: `src/lib/csp.ts` — typed, environment-aware.
- **Test after changes**: verify CSP doesn't block required resources. For hash-based CSP or anything depending on rendered HTML, run `pnpm build` and inspect actual output — source-level reasoning has missed production realities (memory: `feedback_verify_against_real_build.md`).
- **Dev mode**: HMR WebSocket sources, Drizzle Studio frame-src.
- **PowerSync**: `connect-src` for `https://*.powersync.journeyapps.com`.
- **Vercel**: `connect-src` for analytics and speed insights.

## Migration Workflow

**Invoke the `/migrations` skill** — it enforces the full workflow (generate → review SQL → migrate → regenerate sync artifacts → reset dev branch → regenerate docs). Hand-rolling is error-prone.

**Two safety rules the skill guards — also flag them in any review**:

1. **Single migration file for dependent SQL.** `@neondatabase/serverless` runs each migration file as an independent HTTP call, so DDL from one file is **not visible** to the next within the same `drizzle-kit migrate` run. Never split dependent statements across files. Hand-written additions (e.g., RLS policies) that depend on a generated migration must be appended to that same file.
2. **Journal timestamps must be monotonically increasing.** Drizzle-orm only applies migrations whose `when` in `meta/_journal.json` is greater than the last applied. Out-of-order entries are **silently skipped**. After generating or editing a migration, verify the new `when` is strictly greater than every previous entry.

## When Adding a New Feature

**Invoke the `/new-feature` skill** — it scaffolds feature dir, schema, migration, sync artifacts, route, translations, components with empty/loading/error states, tests, module registry, CSP update, and docs regen in one validated flow.

Plans for new features must explicitly cover: offline-first behavior, soft-delete, PWA compat, Next.js 16 modern usage, PowerSync data serialization, mobile-first design, performance, accessibility (ARIA, keyboard, motion-safe), strong TS (branded IDs, no `any`), Vercel Analytics events, all 7 locales with real translations, Playwright E2E. Be explicit about dimensions that don't need changes — don't skip them silently.

## UI/Design Conventions

- **Mobile-first**: design for <768px first, then 768–1024px, then >1024px.
- **Touch targets**: min 44x44px (`min-h-11 min-w-11`). Never `xs` button on mobile.
- **Animations**: sub-200ms, functional only. Use `motion-safe:` to respect `prefers-reduced-motion`.
- **Empty states**: Icon + title + description + primary CTA. Use `ModuleComingSoon` pattern.
- **Loading states**: skeleton for cold start only — offline-first means data is usually instant.
- **Error states**: Error boundary with retry.
- **Mobile nav**: bottom tab bar (<768px) — Dashboard, Repertoire, Plan, Perform, More.
- **Desktop nav**: sidebar.
- **Accent color**: Violet (oklch hue 280). **Always use theme tokens** from `globals.css`, never arbitrary colors.

## LLM Discovery

- `public/llms.txt` and `public/llms-full.txt` — generated from `docs/` via `pnpm docs:generate`. CI fails on staleness. `robots.txt` allows crawling.

## Escalation & Memory

- **`advisor()`** — call for non-trivial work before committing to an approach, and before declaring done. Sees the full transcript and catches direction drift.
- **Auto-memory** at `~/.claude/projects/-Users-jroussel-dev-tml/memory/` is loaded every turn via `MEMORY.md`. Stores "why" context (past incidents, preferences). Memory entries should ADD information (incident dates, prior decisions, external context), never duplicate rules already in this file. Use `/memory <topic>` to recall focused entries mid-task without burning context on the full set.
- **Validation hooks** auto-run on Stop:
  - `pnpm sync:check` if `src/db/schema/**` changed.
  - `pnpm i18n:check` if `src/i18n/messages/*.json` changed.
  - `pnpm typecheck` if any `.ts`/`.tsx` outside tests/scripts changed.
  - Migration journal monotonicity if `_journal.json` changed.
- **PostToolUse** emits edit-time advisories on schema, i18n, migration, CSP, service-worker, `next.config.ts`, `package.json`, and `src/proxy.ts` edits. Heed the nudges — they encode past failure modes.
- **Manual checks**: `/verify` (full suite), `/real-build-check` (production HTML), `/stale-check` (CLAUDE.md vs repo).

## Follow-up Tracking

Review follow-ups live as GitHub Issues with the `review-followup` label. `gh issue list --label review-followup`.
