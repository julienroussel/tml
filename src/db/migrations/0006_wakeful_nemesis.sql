-- Add user_id column to junction tables for direct RLS filtering and sync.
-- Strategy: add nullable → backfill from parent table → cleanup orphans → set NOT NULL → add FK + index.
-- Also updates RLS policies to use direct user_id match for reads, with EXISTS
-- checks on parent FKs for write-path defense-in-depth.

-- routine_tricks: backfill from routines
ALTER TABLE "routine_tricks" ADD COLUMN "user_id" uuid;--> statement-breakpoint
UPDATE "routine_tricks" SET "user_id" = (SELECT "user_id" FROM "routines" WHERE "routines"."id" = "routine_tricks"."routine_id");--> statement-breakpoint
DELETE FROM "routine_tricks" WHERE "user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "routine_tricks" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint

-- practice_session_tricks: backfill from practice_sessions
ALTER TABLE "practice_session_tricks" ADD COLUMN "user_id" uuid;--> statement-breakpoint
UPDATE "practice_session_tricks" SET "user_id" = (SELECT "user_id" FROM "practice_sessions" WHERE "practice_sessions"."id" = "practice_session_tricks"."practice_session_id");--> statement-breakpoint
DELETE FROM "practice_session_tricks" WHERE "user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "practice_session_tricks" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint

-- item_tricks: backfill from items
ALTER TABLE "item_tricks" ADD COLUMN "user_id" uuid;--> statement-breakpoint
UPDATE "item_tricks" SET "user_id" = (SELECT "user_id" FROM "items" WHERE "items"."id" = "item_tricks"."item_id");--> statement-breakpoint
DELETE FROM "item_tricks" WHERE "user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "item_tricks" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint

-- Foreign keys
ALTER TABLE "item_tricks" ADD CONSTRAINT "item_tricks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_session_tricks" ADD CONSTRAINT "practice_session_tricks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_tricks" ADD CONSTRAINT "routine_tricks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Partial indexes
CREATE INDEX "item_tricks_user_id_idx" ON "item_tricks" USING btree ("user_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "practice_session_tricks_user_id_idx" ON "practice_session_tricks" USING btree ("user_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "routine_tricks_user_id_idx" ON "routine_tricks" USING btree ("user_id") WHERE deleted_at IS NULL;--> statement-breakpoint

-- Simplify junction table RLS policies: use direct user_id match for the read
-- path (USING), but keep EXISTS subqueries on parent tables in the write path
-- (WITH CHECK) to prevent cross-user FK references as defense-in-depth.
DROP POLICY IF EXISTS "routine_tricks_rls_policy" ON "routine_tricks";--> statement-breakpoint
CREATE POLICY "routine_tricks_rls_policy" ON "routine_tricks" FOR ALL TO authenticated
  USING (user_id = auth.user_id()::uuid)
  WITH CHECK (
    user_id = auth.user_id()::uuid
    AND EXISTS (SELECT 1 FROM "routines" WHERE "routines".id = "routine_tricks".routine_id AND "routines".user_id = auth.user_id()::uuid)
    AND EXISTS (SELECT 1 FROM "tricks" WHERE "tricks".id = "routine_tricks".trick_id AND "tricks".user_id = auth.user_id()::uuid)
  );--> statement-breakpoint
DROP POLICY IF EXISTS "practice_session_tricks_rls_policy" ON "practice_session_tricks";--> statement-breakpoint
CREATE POLICY "practice_session_tricks_rls_policy" ON "practice_session_tricks" FOR ALL TO authenticated
  USING (user_id = auth.user_id()::uuid)
  WITH CHECK (
    user_id = auth.user_id()::uuid
    AND EXISTS (SELECT 1 FROM "practice_sessions" WHERE "practice_sessions".id = "practice_session_tricks".practice_session_id AND "practice_sessions".user_id = auth.user_id()::uuid)
    AND EXISTS (SELECT 1 FROM "tricks" WHERE "tricks".id = "practice_session_tricks".trick_id AND "tricks".user_id = auth.user_id()::uuid)
  );--> statement-breakpoint
DROP POLICY IF EXISTS "item_tricks_rls_policy" ON "item_tricks";--> statement-breakpoint
CREATE POLICY "item_tricks_rls_policy" ON "item_tricks" FOR ALL TO authenticated
  USING (user_id = auth.user_id()::uuid)
  WITH CHECK (
    user_id = auth.user_id()::uuid
    AND EXISTS (SELECT 1 FROM "items" WHERE "items".id = "item_tricks".item_id AND "items".user_id = auth.user_id()::uuid)
    AND EXISTS (SELECT 1 FROM "tricks" WHERE "tricks".id = "item_tricks".trick_id AND "tricks".user_id = auth.user_id()::uuid)
  );