ALTER TABLE "items" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "brand" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "performances" ADD COLUMN "audience_type" text;--> statement-breakpoint
ALTER TABLE "performances" ADD COLUMN "duration_minutes" integer;--> statement-breakpoint
ALTER TABLE "practice_session_tricks" ADD COLUMN "repetitions" integer;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD COLUMN "mood" integer;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "timezone" text;