-- Enable Row-Level Security on all user-owned tables.
-- RLS is enforced on the `authenticated` role (Neon Data API / PowerSync sync path).
-- The owner role (Drizzle / server actions) bypasses RLS by default.
--
-- NOTE: RLS policies intentionally do NOT filter on deleted_at IS NULL.
-- The PowerSync sync engine needs to see soft-deleted rows (tombstones)
-- to propagate deletions to the client-side SQLite database.

-- Grant permissions to authenticated role.
-- Server-only tables (users, user_preferences) get SELECT-only to enforce
-- least privilege — writes to these tables go through server actions (owner role).
GRANT SELECT ON "users" TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "tricks" TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "routines" TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "routine_tricks" TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "practice_sessions" TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "practice_session_tricks" TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "performances" TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "goals" TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "items" TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "item_tricks" TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "push_subscriptions" TO authenticated;--> statement-breakpoint
GRANT SELECT ON "user_preferences" TO authenticated;--> statement-breakpoint

-- Enable RLS on all tables
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tricks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "routines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "routine_tricks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "practice_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "practice_session_tricks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "performances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "item_tricks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Users table: SELECT-only (server-only table, writes go through owner role)
DROP POLICY IF EXISTS "users_rls_policy" ON "users";--> statement-breakpoint
CREATE POLICY "users_rls_policy" ON "users" FOR SELECT TO authenticated
  USING (id = auth.user_id()::uuid);--> statement-breakpoint

-- User-owned tables: match on user_id
DROP POLICY IF EXISTS "tricks_rls_policy" ON "tricks";--> statement-breakpoint
CREATE POLICY "tricks_rls_policy" ON "tricks" FOR ALL TO authenticated
  USING (user_id = auth.user_id()::uuid) WITH CHECK (user_id = auth.user_id()::uuid);--> statement-breakpoint
DROP POLICY IF EXISTS "routines_rls_policy" ON "routines";--> statement-breakpoint
CREATE POLICY "routines_rls_policy" ON "routines" FOR ALL TO authenticated
  USING (user_id = auth.user_id()::uuid) WITH CHECK (user_id = auth.user_id()::uuid);--> statement-breakpoint
DROP POLICY IF EXISTS "practice_sessions_rls_policy" ON "practice_sessions";--> statement-breakpoint
CREATE POLICY "practice_sessions_rls_policy" ON "practice_sessions" FOR ALL TO authenticated
  USING (user_id = auth.user_id()::uuid) WITH CHECK (user_id = auth.user_id()::uuid);--> statement-breakpoint
DROP POLICY IF EXISTS "performances_rls_policy" ON "performances";--> statement-breakpoint
CREATE POLICY "performances_rls_policy" ON "performances" FOR ALL TO authenticated
  USING (user_id = auth.user_id()::uuid) WITH CHECK (user_id = auth.user_id()::uuid);--> statement-breakpoint
DROP POLICY IF EXISTS "goals_rls_policy" ON "goals";--> statement-breakpoint
CREATE POLICY "goals_rls_policy" ON "goals" FOR ALL TO authenticated
  USING (user_id = auth.user_id()::uuid) WITH CHECK (user_id = auth.user_id()::uuid);--> statement-breakpoint
DROP POLICY IF EXISTS "items_rls_policy" ON "items";--> statement-breakpoint
CREATE POLICY "items_rls_policy" ON "items" FOR ALL TO authenticated
  USING (user_id = auth.user_id()::uuid) WITH CHECK (user_id = auth.user_id()::uuid);--> statement-breakpoint
DROP POLICY IF EXISTS "push_subscriptions_rls_policy" ON "push_subscriptions";--> statement-breakpoint
CREATE POLICY "push_subscriptions_rls_policy" ON "push_subscriptions" FOR ALL TO authenticated
  USING (user_id = auth.user_id()::uuid) WITH CHECK (user_id = auth.user_id()::uuid);--> statement-breakpoint

-- User preferences: SELECT-only (server-only table, writes go through owner role)
DROP POLICY IF EXISTS "user_preferences_rls_policy" ON "user_preferences";--> statement-breakpoint
CREATE POLICY "user_preferences_rls_policy" ON "user_preferences" FOR SELECT TO authenticated
  USING (user_id = auth.user_id()::uuid);--> statement-breakpoint

-- Junction tables: EXISTS subquery on BOTH parent tables to prevent cross-user references.
-- Each junction row must belong to a routine/session/item AND a trick owned by the same user.
DROP POLICY IF EXISTS "routine_tricks_rls_policy" ON "routine_tricks";--> statement-breakpoint
CREATE POLICY "routine_tricks_rls_policy" ON "routine_tricks" FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM "routines" WHERE "routines".id = "routine_tricks".routine_id AND "routines".user_id = auth.user_id()::uuid)
    AND EXISTS (SELECT 1 FROM "tricks" WHERE "tricks".id = "routine_tricks".trick_id AND "tricks".user_id = auth.user_id()::uuid)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM "routines" WHERE "routines".id = "routine_tricks".routine_id AND "routines".user_id = auth.user_id()::uuid)
    AND EXISTS (SELECT 1 FROM "tricks" WHERE "tricks".id = "routine_tricks".trick_id AND "tricks".user_id = auth.user_id()::uuid)
  );--> statement-breakpoint
DROP POLICY IF EXISTS "practice_session_tricks_rls_policy" ON "practice_session_tricks";--> statement-breakpoint
CREATE POLICY "practice_session_tricks_rls_policy" ON "practice_session_tricks" FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM "practice_sessions" WHERE "practice_sessions".id = "practice_session_tricks".practice_session_id AND "practice_sessions".user_id = auth.user_id()::uuid)
    AND EXISTS (SELECT 1 FROM "tricks" WHERE "tricks".id = "practice_session_tricks".trick_id AND "tricks".user_id = auth.user_id()::uuid)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM "practice_sessions" WHERE "practice_sessions".id = "practice_session_tricks".practice_session_id AND "practice_sessions".user_id = auth.user_id()::uuid)
    AND EXISTS (SELECT 1 FROM "tricks" WHERE "tricks".id = "practice_session_tricks".trick_id AND "tricks".user_id = auth.user_id()::uuid)
  );--> statement-breakpoint
DROP POLICY IF EXISTS "item_tricks_rls_policy" ON "item_tricks";--> statement-breakpoint
CREATE POLICY "item_tricks_rls_policy" ON "item_tricks" FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM "items" WHERE "items".id = "item_tricks".item_id AND "items".user_id = auth.user_id()::uuid)
    AND EXISTS (SELECT 1 FROM "tricks" WHERE "tricks".id = "item_tricks".trick_id AND "tricks".user_id = auth.user_id()::uuid)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM "items" WHERE "items".id = "item_tricks".item_id AND "items".user_id = auth.user_id()::uuid)
    AND EXISTS (SELECT 1 FROM "tricks" WHERE "tricks".id = "item_tricks".trick_id AND "tricks".user_id = auth.user_id()::uuid)
  );
