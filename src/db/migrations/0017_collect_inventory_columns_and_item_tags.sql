-- Migration 0017: Collect inventory enhancements
--
-- 1. Add quantity, creator, url columns to items table
-- 2. Add items.type check constraint (10 item types)
-- 3. Add items.quantity non-negative check constraint
-- 4. Create item_tags junction table (mirrors trick_tags)
-- 5. Indexes, RLS, GRANTs, and updated_at trigger for item_tags

-- ============================================================
-- Part 1: New columns on items
-- ============================================================

ALTER TABLE "items" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "creator" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "url" text;--> statement-breakpoint

-- ============================================================
-- Part 2: Check constraints
-- ============================================================

ALTER TABLE "items" ADD CONSTRAINT "items_quantity_non_negative"
  CHECK ("quantity" >= 0) NOT VALID;--> statement-breakpoint
ALTER TABLE "items" VALIDATE CONSTRAINT "items_quantity_non_negative";--> statement-breakpoint

-- Pre-deploy check for items.type CHECK constraint:
--   SELECT DISTINCT type FROM items WHERE type NOT IN
--     ('prop', 'book', 'gimmick', 'dvd', 'download', 'deck',
--      'clothing', 'consumable', 'accessory', 'other');
-- Items table is currently empty in production, so VALIDATE is safe today.
-- The DO $$ block below enforces the precondition at migration time so a
-- future preview branch or seeded dev DB with a stale `type` value fails the
-- migration with a clear error rather than silently leaving the constraint
-- in NOT VALID state.
-- Future enum changes (adding/removing types) MUST run this query first.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM items WHERE type NOT IN
      ('prop', 'book', 'gimmick', 'dvd', 'download', 'deck',
       'clothing', 'consumable', 'accessory', 'other')
  ) THEN
    RAISE EXCEPTION 'items.type contains values outside the allowed enum; fix existing rows before applying items_type_valid';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_type_valid"
  CHECK ("type" IN ('prop', 'book', 'gimmick', 'dvd', 'download', 'deck', 'clothing', 'consumable', 'accessory', 'other')) NOT VALID;--> statement-breakpoint
ALTER TABLE "items" VALIDATE CONSTRAINT "items_type_valid";--> statement-breakpoint

-- ============================================================
-- Part 3: item_tags junction table
-- ============================================================

CREATE TABLE "item_tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "item_id" uuid NOT NULL,
  "tag_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);--> statement-breakpoint

ALTER TABLE "item_tags" ADD CONSTRAINT "item_tags_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_tags" ADD CONSTRAINT "item_tags_item_id_items_id_fk"
  FOREIGN KEY ("item_id") REFERENCES "public"."items"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_tags" ADD CONSTRAINT "item_tags_tag_id_tags_id_fk"
  FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- ============================================================
-- Part 4: Indexes for item_tags
-- ============================================================

CREATE INDEX "item_tags_user_id_idx" ON "item_tags" USING btree ("user_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "item_tags_item_id_idx" ON "item_tags" USING btree ("item_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "item_tags_tag_id_idx" ON "item_tags" USING btree ("tag_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "item_tags_item_tag_idx" ON "item_tags" USING btree ("item_id", "tag_id") WHERE deleted_at IS NULL;--> statement-breakpoint

-- Partial index on deleted_at for cron cleanup job (matches pattern from migration 0010)
CREATE INDEX IF NOT EXISTS "idx_item_tags_deleted_at" ON "item_tags" ("deleted_at") WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

-- ============================================================
-- Part 5: RLS, GRANTs, updated_at trigger
-- ============================================================

ALTER TABLE "item_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON "item_tags" TO authenticated;--> statement-breakpoint

-- ============================================================
-- RLS policy (mirrors trick_tags from migration 0015)
-- ============================================================
-- USING checks only user_id so soft-deleted junction rows remain visible
-- to PowerSync sync (tombstone propagation). Cross-table ownership is
-- enforced on writes via WITH CHECK.
--
-- Threat model:
--   USING checks only the user_id column for tombstone propagation:
--   PowerSync needs to deliver soft-deleted (tombstoned) junction rows to
--   offline clients so they can mirror the deletion locally. Cross-table
--   ownership (items.user_id == auth.user_id and tags.user_id == auth.user_id)
--   is enforced by WITH CHECK on writes — so a malicious client cannot link
--   another user's item to their own tag (or vice versa).
--
--   FK CASCADE on user delete guarantees junction cleanup if a user is
--   hard-deleted, so orphaned junction rows are not possible by ownership
--   drift.
--
--   Defense-in-depth: even if user_id were to drift from the parent row's
--   ownership (e.g., a buggy admin migration), only the user_id-matching
--   user would be able to read or affect the row via this policy.
--
-- WITH CHECK does NOT filter by parent deleted_at: a junction may need to
-- be inserted/restored even when the parent item or tag is being
-- soft-deleted in the same transaction (tombstone propagation, soft-delete
-- resurrection on re-insert via PowerSync upsert). Filtering by
-- deleted_at IS NULL here would block legitimate junction restores that
-- happen to race with parent UPDATE order. This matches trick_tags in 0015.
DROP POLICY IF EXISTS "item_tags_rls_policy" ON "item_tags";--> statement-breakpoint
CREATE POLICY "item_tags_rls_policy" ON "item_tags" FOR ALL TO authenticated
  USING (user_id = auth.user_id()::uuid)
  WITH CHECK (
    user_id = auth.user_id()::uuid
    AND EXISTS (SELECT 1 FROM "items" WHERE "items".id = "item_tags".item_id AND "items".user_id = auth.user_id()::uuid)
    AND EXISTS (SELECT 1 FROM "tags" WHERE "tags".id = "item_tags".tag_id AND "tags".user_id = auth.user_id()::uuid)
  );--> statement-breakpoint

CREATE OR REPLACE TRIGGER "set_updated_at_item_tags"
  BEFORE UPDATE ON "item_tags"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- ============================================================
-- Part 6: URL HTTPS constraint on items
-- ============================================================

ALTER TABLE "items" ADD CONSTRAINT "items_url_https_only"
  CHECK ("url" IS NULL OR "url" LIKE 'https://%') NOT VALID;--> statement-breakpoint
ALTER TABLE "items" VALIDATE CONSTRAINT "items_url_https_only";--> statement-breakpoint

-- ============================================================
-- Part 7: Condition check constraint on items
-- ============================================================

ALTER TABLE "items" ADD CONSTRAINT "items_condition_check"
  CHECK ("condition" IS NULL OR "condition" IN ('new', 'good', 'worn', 'needs_repair')) NOT VALID;--> statement-breakpoint
ALTER TABLE "items" VALIDATE CONSTRAINT "items_condition_check";
