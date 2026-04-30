---
paths:
  - "src/db/schema/**"
  - "src/db/migrations/**"
  - "drizzle.config.ts"
---

# Migration Workflow

**Invoke the `/migrations` skill** — it enforces the full workflow (generate → review SQL → migrate → regenerate sync artifacts → reset dev branch → regenerate docs). Hand-rolling is error-prone.

**Three safety rules the skill guards — also flag them in any review**:

1. **Single migration file for dependent SQL.** `@neondatabase/serverless` runs each migration file as an independent HTTP call, so DDL from one file is **not visible** to the next within the same `drizzle-kit migrate` run. Never split dependent statements across files. Hand-written additions (e.g., RLS policies) that depend on a generated migration must be appended to that same file.
2. **Journal timestamps must be monotonically increasing.** Drizzle-orm only applies migrations whose `when` in `meta/_journal.json` is greater than the last applied. Out-of-order entries are **silently skipped**. After generating or editing a migration, verify the new `when` is strictly greater than every previous entry.
3. **Every `CREATE TABLE` for a synced table needs an explicit `GRANT … TO authenticated;` line in the same migration.** As of `0020_lockdown_authenticated_grants.sql` (issue #245), schema `public` has no default privileges for `authenticated` — tables created without an explicit GRANT are inaccessible to clients (PowerSync queries return empty silently). Reference matrix from 0020:
   - Standard user-data tables: `GRANT SELECT, INSERT, UPDATE, DELETE`.
   - `push_subscriptions`: `GRANT SELECT, INSERT, UPDATE` (no DELETE — cleanup is server-side).
   - `event_log`: `GRANT SELECT, INSERT` + `GRANT UPDATE (deleted_at, updated_at)` (audit-trail invariant — no DELETE, no payload mutation from clients).
   - Server-only tables (`users`, `user_preferences`): `GRANT SELECT` only.
   - RLS policies stay defense-in-depth on top of GRANTs — the GRANT layer is the new enforcement floor; RLS narrows by `user_id`.

## Rollback / recovery

Drizzle migrations are **forward-only**. There is no down-migration tooling.

- **Mistake in a migration that has not yet shipped to prod**: edit the file before merge. If it has been applied to `dev/julien` already, the cheapest fix is `mcp__neon__reset_from_parent` followed by `pnpm db:migrate` to replay from the corrected file. Do this before any other `dev/julien` work piles up — reset wipes the branch.
- **Hash drift on edited-after-apply migrations**. Drizzle records each applied migration's SHA in `__drizzle_migrations`. Editing a file after it has been applied does NOT re-run it on the same branch — the journal entry exists, the recorded hash no longer matches the file, and on a fresh replay (new branch / `reset_from_parent`) Drizzle will refuse the run. **On dev branches**: always pair an edit with `mcp__neon__reset_from_parent` + fresh `pnpm db:migrate`. **On prod**: never edit an applied migration — ship a hotfix migration with the next `idx`.
- **Mistake discovered post-deploy** (e.g., a synced table is inaccessible to `authenticated` because the GRANT line was omitted): ship a hotfix migration. Use the next `idx`, a strictly-greater `when`, and a descriptive tag (`NNNN_hotfix_<thing>.sql`). Triage steps: `SELECT relname, relacl FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relname = '<table>';` — if `authenticated` is missing from `relacl`, add the GRANT in the hotfix.
- **Never re-grant via ad-hoc `psql`**. It bypasses the journal and silently regresses on the next `reset_from_parent` or fresh-project replay.
- **Migrations must run as `neondb_owner`** (the role behind `DATABASE_URL`). 0020's `ALTER DEFAULT PRIVILEGES` is keyed on that grantor; any other table-creating role would silently re-introduce the over-grant. 0020 added a `current_user` assertion (lines 32-36) as the canonical pattern — replicate it in any future migration that touches default privileges or grants.
