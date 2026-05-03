# When Adding a New Feature

**Invoke the `/new-feature` skill** — it scaffolds feature dir, schema, migration, sync artifacts, route, translations, components with empty/loading/error states, tests, module registry, CSP update, and docs regen in one validated flow.

Plans for new features must explicitly cover: offline-first behavior, soft-delete, PWA compat, Next.js 16 modern usage, PowerSync data serialization, mobile-first design, performance, accessibility (ARIA, keyboard, motion-safe), strong TS (branded IDs, no `any`), Vercel Analytics events, all 7 locales with real translations, Playwright E2E. Be explicit about dimensions that don't need changes — don't skip them silently.

**Edit-mode forms with PowerSync junction tables (tags, tricks, etc.):** use `useHydratedSelection<T>` from `src/hooks/use-hydrated-selection.ts`. Never snapshot selection arrays at click time — the sentinel-null + lock-in pattern in the hook prevents the silent-unlink race (issue #216 / PR #257). Canonical call sites: `collect-view.tsx`, `repertoire-view.tsx`.
