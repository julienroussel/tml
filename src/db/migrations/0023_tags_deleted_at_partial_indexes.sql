-- Partial indexes on deleted_at for the cron cleanup job.
-- Mirrors 0010 / 0011 / 0017 — closes the gap left by 0015 for tags and trick_tags.
-- These avoid full table scans on cleanupSyncedTables and the NOT EXISTS subqueries
-- in cleanupUsers (src/app/api/cron/cleanup/route.ts:134, 166).

CREATE INDEX IF NOT EXISTS "idx_tags_deleted_at" ON "tags" ("deleted_at") WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trick_tags_deleted_at" ON "trick_tags" ("deleted_at") WHERE "deleted_at" IS NOT NULL;
