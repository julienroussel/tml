-- Partial indexes on deleted_at for the cron cleanup job.
-- These avoid full table scans when filtering WHERE deleted_at IS NOT NULL.

CREATE INDEX IF NOT EXISTS "idx_goals_deleted_at" ON "goals" ("deleted_at") WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_item_tricks_deleted_at" ON "item_tricks" ("deleted_at") WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_items_deleted_at" ON "items" ("deleted_at") WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_performances_deleted_at" ON "performances" ("deleted_at") WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_practice_session_tricks_deleted_at" ON "practice_session_tricks" ("deleted_at") WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_practice_sessions_deleted_at" ON "practice_sessions" ("deleted_at") WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_routine_tricks_deleted_at" ON "routine_tricks" ("deleted_at") WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_routines_deleted_at" ON "routines" ("deleted_at") WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tricks_deleted_at" ON "tricks" ("deleted_at") WHERE "deleted_at" IS NOT NULL;
