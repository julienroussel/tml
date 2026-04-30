-- 0019: forward-only idempotent fix for missing user_id on item_tricks & practice_session_tricks.
-- Migration 0006 was recorded as applied but two of its three table-level chunks failed silently
-- under @neondatabase/serverless's no-cross-statement-transaction semantics. This brings the
-- schema in line with the Drizzle source of truth on every branch where it has drifted.
-- See issue #220.

-- 1. Add column if missing (no-op on branches where 0006 succeeded fully).
ALTER TABLE "item_tricks"             ADD COLUMN IF NOT EXISTS "user_id" uuid;--> statement-breakpoint
ALTER TABLE "practice_session_tricks" ADD COLUMN IF NOT EXISTS "user_id" uuid;--> statement-breakpoint

-- 2. Backfill from parent (no-op on currently-empty tables; preserved for the canonical pattern
--    and for any branch where rows were inserted with NULL user_id between failed states).
--    Only copy when BOTH parents agree on owner — junction rows with cross-user FK references
--    fall through to the orphan-DELETE in step 3, preventing a tenant boundary cross via the
--    new RLS USING clause (which only checks user_id on the junction, not parent EXISTS).
UPDATE "item_tricks" jt
   SET "user_id" = i."user_id"
  FROM "items" i, "tricks" t
 WHERE i."id" = jt."item_id"
   AND t."id" = jt."trick_id"
   AND i."user_id" = t."user_id"
   AND jt."user_id" IS NULL;--> statement-breakpoint
UPDATE "practice_session_tricks" jt
   SET "user_id" = ps."user_id"
  FROM "practice_sessions" ps, "tricks" t
 WHERE ps."id" = jt."practice_session_id"
   AND t."id" = jt."trick_id"
   AND ps."user_id" = t."user_id"
   AND jt."user_id" IS NULL;--> statement-breakpoint

-- 3. Drop orphans (rows whose parent disappeared) — should be 0 in practice.
DELETE FROM "item_tricks"             WHERE "user_id" IS NULL;--> statement-breakpoint
DELETE FROM "practice_session_tricks" WHERE "user_id" IS NULL;--> statement-breakpoint

-- 4. NOT NULL — Postgres treats SET NOT NULL on an already-NOT-NULL column as a no-op.
ALTER TABLE "item_tricks"             ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "practice_session_tricks" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint

-- 5. FK + partial index (idempotent guards match the 0014 pattern).
DO $$ BEGIN ALTER TABLE "item_tricks" ADD CONSTRAINT "item_tricks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "practice_session_tricks" ADD CONSTRAINT "practice_session_tricks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "item_tricks_user_id_idx"             ON "item_tricks"             USING btree ("user_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "practice_session_tricks_user_id_idx" ON "practice_session_tricks" USING btree ("user_id") WHERE deleted_at IS NULL;--> statement-breakpoint

-- 6. Replace RLS policies with the simplified user_id form (matches 0006's intent for routine_tricks
--    and 0014's setlist_tricks). USING does direct user_id match for read-path speed.
--    WITH CHECK keeps the EXISTS subqueries on parent tables for defense-in-depth on writes.
--    Each DROP+CREATE pair runs inside one DO $$ block so both DDLs land in the same HTTP statement
--    (and one implicit transaction) — avoids the brief deny-all window on `authenticated` between
--    the DROP and CREATE that the @neondatabase/serverless per-statement HTTP semantics would
--    otherwise expose.
DO $$ BEGIN
  DROP POLICY IF EXISTS "item_tricks_rls_policy" ON "item_tricks";
  CREATE POLICY "item_tricks_rls_policy" ON "item_tricks" FOR ALL TO authenticated
    USING (user_id = auth.user_id()::uuid)
    WITH CHECK (
      user_id = auth.user_id()::uuid
      AND EXISTS (SELECT 1 FROM "items"  WHERE "items".id  = "item_tricks".item_id  AND "items".user_id  = auth.user_id()::uuid)
      AND EXISTS (SELECT 1 FROM "tricks" WHERE "tricks".id = "item_tricks".trick_id AND "tricks".user_id = auth.user_id()::uuid)
    );
END $$;--> statement-breakpoint
DO $$ BEGIN
  DROP POLICY IF EXISTS "practice_session_tricks_rls_policy" ON "practice_session_tricks";
  CREATE POLICY "practice_session_tricks_rls_policy" ON "practice_session_tricks" FOR ALL TO authenticated
    USING (user_id = auth.user_id()::uuid)
    WITH CHECK (
      user_id = auth.user_id()::uuid
      AND EXISTS (SELECT 1 FROM "practice_sessions" WHERE "practice_sessions".id = "practice_session_tricks".practice_session_id AND "practice_sessions".user_id = auth.user_id()::uuid)
      AND EXISTS (SELECT 1 FROM "tricks"            WHERE "tricks".id            = "practice_session_tricks".trick_id            AND "tricks".user_id            = auth.user_id()::uuid)
    );
END $$;
