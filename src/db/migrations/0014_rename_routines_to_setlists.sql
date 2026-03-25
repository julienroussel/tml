CREATE TABLE IF NOT EXISTS "setlist_tricks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"setlist_id" uuid NOT NULL,
	"trick_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"transition_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "setlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"estimated_duration_minutes" integer,
	"tags" text[],
	"language" text,
	"environment" text,
	"requirements" text[],
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE IF EXISTS "routine_tricks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "routines" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "routine_tricks" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "routines" CASCADE;--> statement-breakpoint
DROP INDEX IF EXISTS "performances_routine_id_idx";--> statement-breakpoint
ALTER TABLE "performances" ADD COLUMN IF NOT EXISTS "setlist_id" uuid;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "setlist_tricks" ADD CONSTRAINT "setlist_tricks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "setlist_tricks" ADD CONSTRAINT "setlist_tricks_setlist_id_setlists_id_fk" FOREIGN KEY ("setlist_id") REFERENCES "public"."setlists"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "setlist_tricks" ADD CONSTRAINT "setlist_tricks_trick_id_tricks_id_fk" FOREIGN KEY ("trick_id") REFERENCES "public"."tricks"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "setlists" ADD CONSTRAINT "setlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "setlist_tricks_user_id_idx" ON "setlist_tricks" USING btree ("user_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "setlist_tricks_setlist_id_idx" ON "setlist_tricks" USING btree ("setlist_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "setlist_tricks_trick_id_idx" ON "setlist_tricks" USING btree ("trick_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "setlist_tricks_setlist_position_idx" ON "setlist_tricks" USING btree ("setlist_id","position") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "setlists_user_id_idx" ON "setlists" USING btree ("user_id") WHERE deleted_at IS NULL;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "performances" ADD CONSTRAINT "performances_setlist_id_setlists_id_fk" FOREIGN KEY ("setlist_id") REFERENCES "public"."setlists"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "performances_setlist_id_idx" ON "performances" USING btree ("setlist_id") WHERE deleted_at IS NULL;--> statement-breakpoint
DROP TRIGGER IF EXISTS "performances_fk_cascade_updated_at" ON "performances";--> statement-breakpoint
ALTER TABLE "performances" DROP COLUMN IF EXISTS "routine_id";--> statement-breakpoint
CREATE OR REPLACE TRIGGER "set_updated_at_setlists" BEFORE UPDATE ON "setlists" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE OR REPLACE TRIGGER "set_updated_at_setlist_tricks" BEFORE UPDATE ON "setlist_tricks" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE OR REPLACE TRIGGER "performances_fk_cascade_updated_at" BEFORE UPDATE ON "performances" FOR EACH ROW WHEN (OLD.setlist_id IS NOT NULL AND NEW.setlist_id IS NULL) EXECUTE FUNCTION bump_updated_at_on_fk_null();--> statement-breakpoint
ALTER TABLE "setlists" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "setlist_tricks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "setlists" TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "setlist_tricks" TO authenticated;--> statement-breakpoint
DROP POLICY IF EXISTS "setlists_rls_policy" ON "setlists";--> statement-breakpoint
CREATE POLICY "setlists_rls_policy" ON "setlists" FOR ALL TO authenticated USING (user_id = auth.user_id()::uuid) WITH CHECK (user_id = auth.user_id()::uuid);--> statement-breakpoint
DROP POLICY IF EXISTS "setlist_tricks_rls_policy" ON "setlist_tricks";--> statement-breakpoint
CREATE POLICY "setlist_tricks_rls_policy" ON "setlist_tricks" FOR ALL TO authenticated USING (user_id = auth.user_id()::uuid) WITH CHECK (user_id = auth.user_id()::uuid AND EXISTS (SELECT 1 FROM "setlists" WHERE "setlists".id = "setlist_tricks".setlist_id AND "setlists".user_id = auth.user_id()::uuid) AND EXISTS (SELECT 1 FROM "tricks" WHERE "tricks".id = "setlist_tricks".trick_id AND "tricks".user_id = auth.user_id()::uuid));--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "setlists" ADD CONSTRAINT "setlists_estimated_duration_minutes_non_negative" CHECK (estimated_duration_minutes >= 0) NOT VALID; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
ALTER TABLE "setlists" VALIDATE CONSTRAINT "setlists_estimated_duration_minutes_non_negative";--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "setlist_tricks" ADD CONSTRAINT "setlist_tricks_position_non_negative" CHECK (position >= 0) NOT VALID; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
ALTER TABLE "setlist_tricks" VALIDATE CONSTRAINT "setlist_tricks_position_non_negative";