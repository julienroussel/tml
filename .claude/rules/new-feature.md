# When Adding a New Feature

**Invoke the `/new-feature` skill** — it scaffolds feature dir, schema, migration, sync artifacts, route, translations, components with empty/loading/error states, tests, module registry, CSP update, and docs regen in one validated flow.

Plans for new features must explicitly cover: offline-first behavior, soft-delete, PWA compat, Next.js 16 modern usage, PowerSync data serialization, mobile-first design, performance, accessibility (ARIA, keyboard, motion-safe), strong TS (branded IDs, no `any`), Vercel Analytics events, all 7 locales with real translations, Playwright E2E. Be explicit about dimensions that don't need changes — don't skip them silently.
