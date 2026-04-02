-- tricks.duration: 0-7200 seconds (nullable)
ALTER TABLE "tricks" ADD CONSTRAINT "tricks_duration_range"
  CHECK ("duration" BETWEEN 0 AND 7200) NOT VALID;--> statement-breakpoint
ALTER TABLE "tricks" VALIDATE CONSTRAINT "tricks_duration_range";
