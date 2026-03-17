DROP INDEX IF EXISTS "item_tricks_item_trick_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "item_tricks_item_trick_idx" ON "item_tricks" USING btree ("item_id","trick_id") WHERE deleted_at IS NULL;
