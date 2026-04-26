---
description: Run the full validation suite — lint, typecheck, tests, sync drift, i18n parity
allowed-tools: Bash(pnpm lint:*), Bash(pnpm typecheck:*), Bash(pnpm test:run:*), Bash(pnpm sync:check:*), Bash(pnpm i18n:check:*)
---

Run the full validation suite for this repo. Report pass/fail for each step with a terse summary.

Run these in a single parallel batch (they're independent — save time):
1. `pnpm lint` — Biome/Ultracite check
2. `pnpm typecheck` — tsc -b
3. `pnpm test:run` — Vitest single run
4. `pnpm sync:check` — PowerSync artifacts vs Drizzle schema drift
5. `pnpm i18n:check` — 7-locale key parity

For each step: one line — `✓ <step>` on success, or `✗ <step>: <short error>` with the tail of the failing output on a new line.

End with a single summary line: `All green` or `N failure(s) — fix before declaring done`.

Do not attempt fixes. Just report.
