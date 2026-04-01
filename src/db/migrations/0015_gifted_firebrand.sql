CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "trick_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"trick_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "tricks" ADD COLUMN "effect_type" text;--> statement-breakpoint
ALTER TABLE "tricks" ADD COLUMN "duration" integer;--> statement-breakpoint
ALTER TABLE "tricks" ADD COLUMN "performance_type" text;--> statement-breakpoint
ALTER TABLE "tricks" ADD COLUMN "angle_sensitivity" text;--> statement-breakpoint
ALTER TABLE "tricks" ADD COLUMN "props" text;--> statement-breakpoint
ALTER TABLE "tricks" ADD COLUMN "music" text;--> statement-breakpoint
ALTER TABLE "tricks" ADD COLUMN "languages" text[];--> statement-breakpoint
ALTER TABLE "tricks" ADD COLUMN "is_camera_friendly" boolean;--> statement-breakpoint
ALTER TABLE "tricks" ADD COLUMN "is_silent" boolean;--> statement-breakpoint
ALTER TABLE "tricks" ADD COLUMN "video_url" text;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trick_tags" ADD CONSTRAINT "trick_tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trick_tags" ADD CONSTRAINT "trick_tags_trick_id_tricks_id_fk" FOREIGN KEY ("trick_id") REFERENCES "public"."tricks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trick_tags" ADD CONSTRAINT "trick_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tags_user_id_idx" ON "tags" USING btree ("user_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tags_user_name_idx" ON "tags" USING btree ("user_id",lower(name)) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "trick_tags_user_id_idx" ON "trick_tags" USING btree ("user_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "trick_tags_trick_id_idx" ON "trick_tags" USING btree ("trick_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "trick_tags_tag_id_idx" ON "trick_tags" USING btree ("tag_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "trick_tags_trick_tag_idx" ON "trick_tags" USING btree ("trick_id","tag_id") WHERE deleted_at IS NULL;--> statement-breakpoint
ALTER TABLE "tricks" DROP COLUMN "tags";--> statement-breakpoint

-- RLS, GRANTs, and updated_at triggers for tags and trick_tags

ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trick_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON "tags" TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "trick_tags" TO authenticated;--> statement-breakpoint

DROP POLICY IF EXISTS "tags_rls_policy" ON "tags";--> statement-breakpoint
CREATE POLICY "tags_rls_policy" ON "tags" FOR ALL TO authenticated
  USING (user_id = auth.user_id()::uuid)
  WITH CHECK (user_id = auth.user_id()::uuid);--> statement-breakpoint

DROP POLICY IF EXISTS "trick_tags_rls_policy" ON "trick_tags";--> statement-breakpoint
-- USING checks only user_id so soft-deleted junction rows remain visible
-- to PowerSync sync (tombstone propagation). Cross-table ownership is
-- enforced on writes via WITH CHECK.
CREATE POLICY "trick_tags_rls_policy" ON "trick_tags" FOR ALL TO authenticated
  USING (user_id = auth.user_id()::uuid)
  WITH CHECK (
    user_id = auth.user_id()::uuid
    AND EXISTS (SELECT 1 FROM "tags" WHERE "tags".id = "trick_tags".tag_id AND "tags".user_id = auth.user_id()::uuid)
    AND EXISTS (SELECT 1 FROM "tricks" WHERE "tricks".id = "trick_tags".trick_id AND "tricks".user_id = auth.user_id()::uuid)
  );--> statement-breakpoint

CREATE OR REPLACE TRIGGER "set_updated_at_tags"
  BEFORE UPDATE ON "tags"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

CREATE OR REPLACE TRIGGER "set_updated_at_trick_tags"
  BEFORE UPDATE ON "trick_tags"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

ALTER TABLE "tricks" ADD CONSTRAINT "tricks_performance_type_check"
  CHECK ("performance_type" IN ('close_up', 'parlor', 'stage', 'street', 'virtual')) NOT VALID;--> statement-breakpoint
ALTER TABLE "tricks" VALIDATE CONSTRAINT "tricks_performance_type_check";--> statement-breakpoint

ALTER TABLE "tricks" ADD CONSTRAINT "tricks_angle_sensitivity_check"
  CHECK ("angle_sensitivity" IN ('none', 'slight', 'moderate', 'high')) NOT VALID;--> statement-breakpoint
ALTER TABLE "tricks" VALIDATE CONSTRAINT "tricks_angle_sensitivity_check";