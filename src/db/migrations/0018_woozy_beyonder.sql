CREATE TABLE "event_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source" text DEFAULT 'client' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "event_log" ADD CONSTRAINT "event_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_log_user_id_created_at_idx" ON "event_log" USING btree ("user_id","created_at") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "event_log_event_type_idx" ON "event_log" USING btree ("event_type","created_at") WHERE deleted_at IS NULL;--> statement-breakpoint

-- ============================================================
-- RLS, GRANTs, policy, updated_at trigger for event_log
-- (mirrors the pattern from 0017 item_tags / 0015 trick_tags)
-- ============================================================

ALTER TABLE "event_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Audit-trail invariant: rows are append-only from authenticated clients.
-- Only deleted_at/updated_at are mutable to allow soft-delete and last-write-wins
-- sync. DELETE is intentionally not granted — the soft-delete path goes through
-- UPDATE on deleted_at, and GDPR account-removal hard-delete runs as the admin
-- role via the users.id ON DELETE CASCADE foreign key, not as `authenticated`.
GRANT SELECT, INSERT ON "event_log" TO authenticated;--> statement-breakpoint
GRANT UPDATE (deleted_at, updated_at) ON "event_log" TO authenticated;--> statement-breakpoint

-- USING checks only user_id so soft-deleted rows remain visible to PowerSync
-- sync (tombstone propagation). user_id is enforced server-side by the
-- PowerSync upload handler — never trust client-supplied user_id.
DROP POLICY IF EXISTS "event_log_rls_policy" ON "event_log";--> statement-breakpoint
CREATE POLICY "event_log_rls_policy" ON "event_log" FOR ALL TO authenticated
  USING (user_id = auth.user_id()::uuid)
  WITH CHECK (user_id = auth.user_id()::uuid);--> statement-breakpoint

CREATE OR REPLACE TRIGGER "set_updated_at_event_log"
  BEFORE UPDATE ON "event_log"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

ALTER TABLE "event_log" ADD CONSTRAINT "event_log_source_check" CHECK (source IN ('client', 'server'));--> statement-breakpoint
ALTER TABLE "event_log" ADD CONSTRAINT "event_log_entity_pair_check" CHECK ((entity_type IS NULL AND entity_id IS NULL) OR (entity_type IS NOT NULL AND entity_id IS NOT NULL));