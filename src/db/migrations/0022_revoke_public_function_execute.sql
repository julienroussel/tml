-- 0022: revoke EXECUTE on public functions from PUBLIC (issue #253 follow-up).
--
-- 0021 attempted to lock down `authenticated` EXECUTE on schema-public functions via:
--   ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM authenticated;
--   REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;
--
-- Both lines were no-ops in practice. PostgreSQL auto-grants EXECUTE to PUBLIC on every
-- new function (regardless of default ACLs), and `authenticated` inherits EXECUTE via
-- PUBLIC — never via a direct grant. Revoking from `authenticated` therefore removed
-- nothing, and pg_default_acl shows zero `neondb_owner`-grantor rows because
-- ALTER DEFAULT PRIVILEGES … REVOKE on a privilege that was never granted is silently
-- dropped (no deny entry written).
--
-- Verified post-0021 on dev/julien (2026-05-03):
--   pg_proc.proacl for set_updated_at, bump_updated_at_on_fk_null, show_db_tree:
--     {=X/neondb_owner,neondb_owner=X/neondb_owner}
--   has_function_privilege('authenticated', '<fn>', 'EXECUTE') -> true (via PUBLIC).
--
-- This migration aligns reality with 0021's stated model:
--   1. Revoke EXECUTE from PUBLIC at the default-ACL level so future functions in public
--      do NOT auto-grant to PUBLIC.
--   2. Sweep existing functions: REVOKE EXECUTE … FROM PUBLIC.
--
-- Why this is safe for the 3 existing helpers:
--   - set_updated_at, bump_updated_at_on_fk_null are invoker-rights trigger functions.
--     PostgreSQL checks trigger-function EXECUTE against the trigger DEFINER
--     (neondb_owner), not the firing role — triggers continue to fire normally.
--   - show_db_tree is an introspection helper called by neondb_owner directly; owner
--     EXECUTE is implicit (the {neondb_owner=X/neondb_owner} entry survives), so
--     server-side calls are unaffected.
--
-- Going forward the rule from 0021 still applies: any new SECURITY DEFINER function in
-- public MUST include explicit `REVOKE EXECUTE ON FUNCTION <name>(...) FROM PUBLIC,
-- authenticated;` in the same migration. The `FROM PUBLIC` half is now also enforced
-- at the default-ACL layer; the explicit revoke remains required because Postgres
-- still auto-grants on `CREATE FUNCTION` regardless of default ACLs (the default-ACL
-- revoke only neutralizes the auto-grant for a brief window between CREATE and the
-- next privilege check). Belt-and-suspenders.
--
-- Runs inside one PL/pgSQL anonymous DO block — one HTTP call under @neondatabase/serverless,
-- one implicit transaction. All-or-nothing application.
--
-- ROLLBACK / RECOVERY: forward-only. If a future function legitimately needs PUBLIC
-- EXECUTE, ship the explicit GRANT in that migration; do not revert this revoke.

DO $$ BEGIN
  IF current_user <> 'neondb_owner' THEN
    RAISE EXCEPTION
      'Migration 0022 must run as neondb_owner to ensure ALTER DEFAULT PRIVILEGES grantor consistency; got: %',
      current_user;
  END IF;

  ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
    REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

  REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
END $$;
