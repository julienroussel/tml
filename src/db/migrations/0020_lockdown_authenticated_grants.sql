-- 0020: lock down the `authenticated` role's CRUD privileges (issue #245).
--
-- Phase 0 investigation (run against dev/julien on 2026-04-30) confirmed pg_default_acl
-- on schema "public" auto-grants {authenticated=arwd/neondb_owner} on every CREATE TABLE,
-- silently overriding migration-level scoped GRANTs (notably 0018 on event_log, which
-- intended SELECT/INSERT + column-UPDATE only). This migration:
--
--   1. Asserts current_user = neondb_owner — ALTER DEFAULT PRIVILEGES is keyed on the
--      grantor; running as any other role would silently fail to neutralize the auto-grant.
--   2. GRANT USAGE ON SCHEMA public TO authenticated — defensive idempotent re-grant so a
--      fresh-project replay (post mcp__neon__reset_from_parent on a project that lacks the
--      Neon Auth bootstrap USAGE grant) cannot leave authenticated unable to access tables.
--   3. REVOKEs all current grants per table (clears table-level + column-level).
--   4. Re-GRANTs with the correct narrow scope per table (defense-in-depth — see route.ts
--      gates and RLS policies, which remain in place).
--   5. ALTER DEFAULT PRIVILEGES so future CREATE TABLE no longer auto-grants. From now on,
--      every new synced table MUST include an explicit GRANT line in the same migration.
--
-- The entire migration runs inside ONE PL/pgSQL anonymous DO block — i.e., one HTTP call
-- under @neondatabase/serverless = one implicit transaction. Either every step lands or
-- none do, eliminating the silent-partial-apply failure mode that hit issue #220 (where a
-- multi-chunk migration was recorded as applied with only the first chunk committed).
--
-- ROLLBACK / RECOVERY: forward-only. If a future synced table is found to be inaccessible
-- to authenticated post-deploy, ship a hotfix migration adding the missing GRANT (see
-- .claude/rules/migrations.md §3 for the per-table-class matrix). Do NOT re-grant via
-- ad-hoc psql — it bypasses the journal and will silently regress on the next
-- reset_from_parent.

DO $$ BEGIN
  -- Step 1: assert grantor consistency.
  IF current_user <> 'neondb_owner' THEN
    RAISE EXCEPTION
      'Migration 0020 must run as neondb_owner to ensure ALTER DEFAULT PRIVILEGES grantor consistency; got: %',
      current_user;
  END IF;

  -- Step 2: schema-level USAGE for authenticated (idempotent defensive).
  GRANT USAGE ON SCHEMA public TO authenticated;

  -- Step 3: scrub all prior table grants. REVOKE ALL clears table-level + column-level.
  REVOKE ALL ON TABLE
    "tricks", "setlists", "setlist_tricks",
    "practice_sessions", "practice_session_tricks",
    "performances", "goals",
    "items", "item_tricks", "item_tags",
    "tags", "trick_tags",
    "push_subscriptions", "event_log",
    "users", "user_preferences"
  FROM authenticated;

  -- Step 4: re-grant with narrow scope per table-class.

  -- 4a. Standard user-data tables — full CRUD for authenticated clients.
  GRANT SELECT, INSERT, UPDATE, DELETE ON
    "tricks", "setlists", "setlist_tricks",
    "practice_sessions", "practice_session_tricks",
    "performances", "goals",
    "items", "item_tricks", "item_tags",
    "tags", "trick_tags"
  TO authenticated;

  -- 4b. push_subscriptions — clients can read/insert/update; cleanup of expired
  --     subscriptions happens server-side via neondb_owner connection.
  GRANT SELECT, INSERT, UPDATE ON "push_subscriptions" TO authenticated;

  -- 4c. event_log — audit-trail invariant for the `authenticated` role only. No DELETE;
  --     UPDATE only on lifecycle columns (deleted_at for soft-delete, updated_at
  --     maintained by the trigger). NOTE: the live PowerSync upload path runs as
  --     `neondb_owner` via DATABASE_URL Pool (route.ts:180) and bypasses these GRANTs
  --     and RLS, so the audit-trail invariant on the live write path is still enforced
  --     solely by the 422 gate at route.ts:122-144 — do NOT weaken or remove that gate
  --     without first migrating the upload route to a JWT-forwarding `authenticated`
  --     connection. This GRANT layer is forward-positioning + hardening against an
  --     accidental DATABASE_URL swap to a less-privileged role.
  GRANT SELECT, INSERT ON "event_log" TO authenticated;
  GRANT UPDATE ("deleted_at", "updated_at") ON "event_log" TO authenticated;

  -- 4d. Server-write-only tables (Neon Auth + user prefs) — read access only.
  GRANT SELECT ON "users", "user_preferences" TO authenticated;

  -- Step 5: stop pg_default_acl from re-granting full CRUD on the next CREATE TABLE.
  --         Sequence and function defaults are intentionally left untouched (see #253
  --         follow-up); current schema uses uuid().defaultRandom() PKs everywhere.
  ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
    REVOKE ALL ON TABLES FROM authenticated;
END $$;
