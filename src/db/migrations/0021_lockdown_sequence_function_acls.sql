-- 0021: lock down sequence and function privileges for `authenticated` (issue #253).
--
-- Follow-up to 0020 (#245). 0020 revoked the default table ACL but intentionally left
-- pg_default_acl for sequences (U/USAGE) and functions (X/EXECUTE) on schema public
-- granting to `authenticated`. Today's tree uses uuid().defaultRandom() PKs everywhere
-- (no SERIAL/IDENTITY) and has zero SECURITY DEFINER functions in public (audited via
-- pg_proc on 2026-05-03 — see issue #253 for the audit query + result), so the holes
-- are dormant. They become live the moment a future migration adds:
--   - a SERIAL/IDENTITY column or `CREATE SEQUENCE` on a synced table — `authenticated`
--     would silently auto-grant USAGE on the sequence, allowing out-of-band `nextval()`
--     to burn IDs or `currval()` for enumeration.
--   - a `SECURITY DEFINER` function in public — `authenticated` would silently auto-grant
--     EXECUTE, a privilege-escalation primitive that bypasses RLS and column GRANTs.
--
-- This migration:
--   1. Asserts current_user = neondb_owner — same grantor-consistency invariant as 0020,
--      since ALTER DEFAULT PRIVILEGES is keyed on the grantor.
--   2. Revokes default sequence + function ACLs for `authenticated` so future objects
--      created in public are inaccessible to that role unless explicitly granted.
--   3. Sweeps existing function EXECUTE grants (covers the 3 invoker-rights helpers
--      `set_updated_at`, `bump_updated_at_on_fk_null`, `show_db_tree`). The
--      `REVOKE EXECUTE ON ALL FUNCTIONS` form is signature-agnostic and matches the
--      spirit of the default-ACL revoke.
--
-- Going forward, mirroring 0020's table convention:
--   - Any new `CREATE SEQUENCE` (or sequence-defaulted column) on a synced table MUST
--     include `GRANT USAGE, SELECT ON SEQUENCE … TO authenticated;` in the same migration.
--   - Any new `SECURITY DEFINER` function in public MUST include explicit
--     `REVOKE EXECUTE … FROM PUBLIC, authenticated;` plus targeted GRANTs as needed.
--
-- Runs inside one PL/pgSQL anonymous DO block — one HTTP call under @neondatabase/serverless,
-- one implicit transaction. All-or-nothing application.
--
-- ROLLBACK / RECOVERY: forward-only. If a future migration legitimately needs a sequence or
-- function accessible to `authenticated`, ship the explicit GRANT in that migration; do not
-- revert the default-ACL revoke.

DO $$ BEGIN
  IF current_user <> 'neondb_owner' THEN
    RAISE EXCEPTION
      'Migration 0021 must run as neondb_owner to ensure ALTER DEFAULT PRIVILEGES grantor consistency; got: %',
      current_user;
  END IF;

  ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
    REVOKE ALL ON SEQUENCES FROM authenticated;

  ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
    REVOKE ALL ON FUNCTIONS FROM authenticated;

  -- Safe for the trigger functions (set_updated_at, bump_updated_at_on_fk_null):
  -- PostgreSQL checks trigger-function EXECUTE against the trigger DEFINER
  -- (neondb_owner here), not the firing user — so REVOKE EXECUTE from
  -- authenticated does not break BEFORE/AFTER triggers on synced tables.
  -- (See PG docs: "Triggers" — run-time permission checks are performed
  -- against the user that defined the trigger.)
  REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;
END $$;
