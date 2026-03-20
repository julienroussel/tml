ALTER TABLE "item_tricks" DROP CONSTRAINT "item_tricks_item_id_items_id_fk";
--> statement-breakpoint
ALTER TABLE "item_tricks" DROP CONSTRAINT "item_tricks_trick_id_tricks_id_fk";
--> statement-breakpoint
ALTER TABLE "practice_session_tricks" DROP CONSTRAINT "practice_session_tricks_practice_session_id_practice_sessions_id_fk";
--> statement-breakpoint
ALTER TABLE "practice_session_tricks" DROP CONSTRAINT "practice_session_tricks_trick_id_tricks_id_fk";
--> statement-breakpoint
ALTER TABLE "routine_tricks" DROP CONSTRAINT "routine_tricks_routine_id_routines_id_fk";
--> statement-breakpoint
ALTER TABLE "routine_tricks" DROP CONSTRAINT "routine_tricks_trick_id_tricks_id_fk";
--> statement-breakpoint
ALTER TABLE "item_tricks" ADD CONSTRAINT "item_tricks_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_tricks" ADD CONSTRAINT "item_tricks_trick_id_tricks_id_fk" FOREIGN KEY ("trick_id") REFERENCES "public"."tricks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_session_tricks" ADD CONSTRAINT "practice_session_tricks_practice_session_id_practice_sessions_id_fk" FOREIGN KEY ("practice_session_id") REFERENCES "public"."practice_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_session_tricks" ADD CONSTRAINT "practice_session_tricks_trick_id_tricks_id_fk" FOREIGN KEY ("trick_id") REFERENCES "public"."tricks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_tricks" ADD CONSTRAINT "routine_tricks_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_tricks" ADD CONSTRAINT "routine_tricks_trick_id_tricks_id_fk" FOREIGN KEY ("trick_id") REFERENCES "public"."tricks"("id") ON DELETE no action ON UPDATE no action;