---
description: Compare CLAUDE.md claims against the current repo state and report discrepancies
allowed-tools: Bash(jq:*), Bash(git ls-files:*), Bash(find src:*), Bash(find scripts:*), Bash(find .claude:*), Bash(find docs:*), Bash(ls:*), Read, Grep
---

Audit `CLAUDE.md` against the current repo state. Report discrepancies — do not fix them.

Cross-check each category, ideally in parallel Bash calls:

1. **Scripts** — `jq -r '.scripts | keys[]' package.json` vs scripts referenced in CLAUDE.md. Flag both directions (docs without scripts AND scripts without docs).
2. **Stack packages** — for each package named in CLAUDE.md's Stack section, verify presence in `dependencies` or `devDependencies` (`jq -r '.dependencies + .devDependencies | keys[]' package.json`). Also list packages installed but NOT mentioned.
3. **File paths** — for each file/directory path cited in CLAUDE.md (`src/proxy.ts`, `src/lib/csp.ts`, `src/test/factories.ts`, `src/test/mocks.tsx`, `src/test/render.tsx`, `src/lib/modules.ts`, `src/lib/utils.ts`, `src/app/manifest.ts`, `public/sw.js`, `scripts/generate-sync.ts`, `scripts/check-i18n.ts`, `scripts/powersync.ts`), verify it exists.
4. **Route groups** — verify `src/app/(app)/`, `src/app/(marketing)/[locale]/`, `src/app/auth/`, `src/app/api/`.
5. **i18n locales** — `ls src/i18n/messages/` should show exactly the 7 locales claimed (en, fr, es, pt, it, de, nl).
6. **Version-sensitive claims**:
   - `proxy.ts` exists; `middleware.ts` does NOT exist
   - `next.config.ts` contains `reactCompiler: true` at top level (not under `experimental`)
   - `globals.css` contains `@import "tailwindcss"` and at least one `@theme inline` block
   - `biome.json` extends `ultracite/biome/core`
   - No `tailwind.config.js` / `.ts` exists at repo root
7. **Features enumerated** — `ls src/features/` vs the list in CLAUDE.md (`collect, enhance, improve, perform, plan, repertoire, settings, train`).

Report as a single markdown table:

| Claim | Status | Evidence |
|---|---|---|
| ... | ✓ / ✗ / ⚠ | file:line or command output |

End with a count of discrepancies and a ranked list of the top 3 that most warrant fixing in CLAUDE.md.
