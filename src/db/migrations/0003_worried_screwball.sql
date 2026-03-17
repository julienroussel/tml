-- Migration 0003: Add partial indexes (WHERE deleted_at IS NULL), set gen_random_uuid() defaults, add users email unique constraint.
--
-- Index operations use CONCURRENTLY to avoid blocking reads/writes on production tables.
-- CONCURRENTLY cannot run inside a transaction, so this migration must be run outside of one.
-- NOTE: Neon's HTTP driver does not support CONCURRENTLY — apply this migration via a direct
-- TCP connection (psql with the Neon direct connection string) or the Neon SQL Editor.
DROP INDEX CONCURRENTLY IF EXISTS "goals_user_id_idx";--> statement-breakpoint
DROP INDEX CONCURRENTLY IF EXISTS "goals_trick_id_idx";--> statement-breakpoint
DROP INDEX CONCURRENTLY IF EXISTS "item_tricks_item_id_idx";--> statement-breakpoint
DROP INDEX CONCURRENTLY IF EXISTS "item_tricks_trick_id_idx";--> statement-breakpoint
DROP INDEX CONCURRENTLY IF EXISTS "item_tricks_item_trick_idx";--> statement-breakpoint
DROP INDEX CONCURRENTLY IF EXISTS "items_user_id_idx";--> statement-breakpoint
DROP INDEX CONCURRENTLY IF EXISTS "performances_user_id_idx";--> statement-breakpoint
DROP INDEX CONCURRENTLY IF EXISTS "performances_routine_id_idx";--> statement-breakpoint
DROP INDEX CONCURRENTLY IF EXISTS "practice_session_tricks_practice_session_id_idx";--> statement-breakpoint
DROP INDEX CONCURRENTLY IF EXISTS "practice_session_tricks_trick_id_idx";--> statement-breakpoint
DROP INDEX CONCURRENTLY IF EXISTS "practice_sessions_user_id_idx";--> statement-breakpoint
DROP INDEX CONCURRENTLY IF EXISTS "routine_tricks_routine_id_idx";--> statement-breakpoint
DROP INDEX CONCURRENTLY IF EXISTS "routine_tricks_trick_id_idx";--> statement-breakpoint
DROP INDEX CONCURRENTLY IF EXISTS "routine_tricks_routine_position_idx";--> statement-breakpoint
DROP INDEX CONCURRENTLY IF EXISTS "routines_user_id_idx";--> statement-breakpoint
DROP INDEX CONCURRENTLY IF EXISTS "tricks_user_id_idx";--> statement-breakpoint
ALTER TABLE "goals" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "item_tricks" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "performances" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "practice_session_tricks" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "practice_sessions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "routine_tricks" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "routines" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "tricks" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
CREATE INDEX CONCURRENTLY "performances_user_id_date_idx" ON "performances" USING btree ("user_id","date") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX CONCURRENTLY "practice_sessions_user_id_date_idx" ON "practice_sessions" USING btree ("user_id","date") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX CONCURRENTLY "goals_user_id_idx" ON "goals" USING btree ("user_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX CONCURRENTLY "goals_trick_id_idx" ON "goals" USING btree ("trick_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX CONCURRENTLY "item_tricks_item_id_idx" ON "item_tricks" USING btree ("item_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX CONCURRENTLY "item_tricks_trick_id_idx" ON "item_tricks" USING btree ("trick_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "item_tricks_item_trick_idx" ON "item_tricks" USING btree ("item_id","trick_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX CONCURRENTLY "items_user_id_idx" ON "items" USING btree ("user_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX CONCURRENTLY "performances_user_id_idx" ON "performances" USING btree ("user_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX CONCURRENTLY "performances_routine_id_idx" ON "performances" USING btree ("routine_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX CONCURRENTLY "practice_session_tricks_practice_session_id_idx" ON "practice_session_tricks" USING btree ("practice_session_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX CONCURRENTLY "practice_session_tricks_trick_id_idx" ON "practice_session_tricks" USING btree ("trick_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX CONCURRENTLY "practice_sessions_user_id_idx" ON "practice_sessions" USING btree ("user_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX CONCURRENTLY "routine_tricks_routine_id_idx" ON "routine_tricks" USING btree ("routine_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX CONCURRENTLY "routine_tricks_trick_id_idx" ON "routine_tricks" USING btree ("trick_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "routine_tricks_routine_position_idx" ON "routine_tricks" USING btree ("routine_id","position") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX CONCURRENTLY "routines_user_id_idx" ON "routines" USING btree ("user_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX CONCURRENTLY "tricks_user_id_idx" ON "tricks" USING btree ("user_id") WHERE deleted_at IS NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");
