-- Migration 0009: Add updated_at triggers and CHECK constraints
--
-- 1. Generic BEFORE UPDATE trigger that sets updated_at = NOW() when the
--    application omits an explicit updated_at value. This is a safety net for
--    operations that bypass Drizzle ORM (e.g., Neon Data API raw SQL, future
--    integrations). The guard (NEW.updated_at = OLD.updated_at) ensures the
--    trigger does NOT overwrite an explicitly provided value — buildQuery()
--    in the PowerSync connector already sets updated_at = NOW() in the SQL.
--
-- 2. CHECK constraints on integer columns to prevent invalid data at the
--    database level — the last line of defense after client and server
--    validation.

-- ============================================================
-- Part 1: updated_at trigger function and per-table triggers
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  -- Only auto-set if the application did not explicitly change updated_at.
  -- This avoids double-writes when buildQuery() or Drizzle $onUpdate
  -- already set the value.
  IF NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

-- users
CREATE OR REPLACE TRIGGER set_updated_at_users
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- user_preferences
CREATE OR REPLACE TRIGGER set_updated_at_user_preferences
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- tricks
CREATE OR REPLACE TRIGGER set_updated_at_tricks
  BEFORE UPDATE ON tricks
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- routines
CREATE OR REPLACE TRIGGER set_updated_at_routines
  BEFORE UPDATE ON routines
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- routine_tricks
CREATE OR REPLACE TRIGGER set_updated_at_routine_tricks
  BEFORE UPDATE ON routine_tricks
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- practice_sessions
CREATE OR REPLACE TRIGGER set_updated_at_practice_sessions
  BEFORE UPDATE ON practice_sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- practice_session_tricks
CREATE OR REPLACE TRIGGER set_updated_at_practice_session_tricks
  BEFORE UPDATE ON practice_session_tricks
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- performances
CREATE OR REPLACE TRIGGER set_updated_at_performances
  BEFORE UPDATE ON performances
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- items
CREATE OR REPLACE TRIGGER set_updated_at_items
  BEFORE UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- item_tricks
CREATE OR REPLACE TRIGGER set_updated_at_item_tricks
  BEFORE UPDATE ON item_tricks
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- goals
CREATE OR REPLACE TRIGGER set_updated_at_goals
  BEFORE UPDATE ON goals
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- ============================================================
-- Part 2: CHECK constraints on integer columns
-- ============================================================

-- tricks.difficulty: 1-5 scale (nullable)
ALTER TABLE tricks ADD CONSTRAINT tricks_difficulty_range
  CHECK (difficulty BETWEEN 1 AND 5) NOT VALID;--> statement-breakpoint
ALTER TABLE tricks VALIDATE CONSTRAINT tricks_difficulty_range;--> statement-breakpoint

-- performances.audience_size: non-negative (nullable)
ALTER TABLE performances ADD CONSTRAINT performances_audience_size_non_negative
  CHECK (audience_size >= 0) NOT VALID;--> statement-breakpoint
ALTER TABLE performances VALIDATE CONSTRAINT performances_audience_size_non_negative;--> statement-breakpoint

-- performances.duration_minutes: non-negative (nullable)
ALTER TABLE performances ADD CONSTRAINT performances_duration_minutes_non_negative
  CHECK (duration_minutes >= 0) NOT VALID;--> statement-breakpoint
ALTER TABLE performances VALIDATE CONSTRAINT performances_duration_minutes_non_negative;--> statement-breakpoint

-- performances.rating: 1-5 scale (nullable)
ALTER TABLE performances ADD CONSTRAINT performances_rating_range
  CHECK (rating BETWEEN 1 AND 5) NOT VALID;--> statement-breakpoint
ALTER TABLE performances VALIDATE CONSTRAINT performances_rating_range;--> statement-breakpoint

-- practice_sessions.duration_minutes: positive (not null)
ALTER TABLE practice_sessions ADD CONSTRAINT practice_sessions_duration_minutes_positive
  CHECK (duration_minutes > 0) NOT VALID;--> statement-breakpoint
ALTER TABLE practice_sessions VALIDATE CONSTRAINT practice_sessions_duration_minutes_positive;--> statement-breakpoint

-- practice_sessions.mood: 1-5 scale (nullable)
ALTER TABLE practice_sessions ADD CONSTRAINT practice_sessions_mood_range
  CHECK (mood BETWEEN 1 AND 5) NOT VALID;--> statement-breakpoint
ALTER TABLE practice_sessions VALIDATE CONSTRAINT practice_sessions_mood_range;--> statement-breakpoint

-- practice_session_tricks.repetitions: non-negative (nullable)
ALTER TABLE practice_session_tricks ADD CONSTRAINT practice_session_tricks_repetitions_non_negative
  CHECK (repetitions >= 0) NOT VALID;--> statement-breakpoint
ALTER TABLE practice_session_tricks VALIDATE CONSTRAINT practice_session_tricks_repetitions_non_negative;--> statement-breakpoint

-- practice_session_tricks.rating: 1-5 scale (nullable)
ALTER TABLE practice_session_tricks ADD CONSTRAINT practice_session_tricks_rating_range
  CHECK (rating BETWEEN 1 AND 5) NOT VALID;--> statement-breakpoint
ALTER TABLE practice_session_tricks VALIDATE CONSTRAINT practice_session_tricks_rating_range;--> statement-breakpoint

-- routines.estimated_duration_minutes: non-negative (nullable)
ALTER TABLE routines ADD CONSTRAINT routines_estimated_duration_minutes_non_negative
  CHECK (estimated_duration_minutes >= 0) NOT VALID;--> statement-breakpoint
ALTER TABLE routines VALIDATE CONSTRAINT routines_estimated_duration_minutes_non_negative;--> statement-breakpoint

-- routine_tricks.position: non-negative (not null)
ALTER TABLE routine_tricks ADD CONSTRAINT routine_tricks_position_non_negative
  CHECK (position >= 0) NOT VALID;--> statement-breakpoint
ALTER TABLE routine_tricks VALIDATE CONSTRAINT routine_tricks_position_non_negative;--> statement-breakpoint

-- goals.target_value: non-negative (nullable)
ALTER TABLE goals ADD CONSTRAINT goals_target_value_non_negative
  CHECK (target_value >= 0) NOT VALID;--> statement-breakpoint
ALTER TABLE goals VALIDATE CONSTRAINT goals_target_value_non_negative;--> statement-breakpoint

-- goals.current_value: non-negative (has default 0)
ALTER TABLE goals ADD CONSTRAINT goals_current_value_non_negative
  CHECK (current_value >= 0) NOT VALID;--> statement-breakpoint
ALTER TABLE goals VALIDATE CONSTRAINT goals_current_value_non_negative;--> statement-breakpoint

-- items.purchase_price: non-negative (nullable, numeric(10,2))
ALTER TABLE items ADD CONSTRAINT items_purchase_price_non_negative
  CHECK (purchase_price >= 0) NOT VALID;--> statement-breakpoint
ALTER TABLE items VALIDATE CONSTRAINT items_purchase_price_non_negative;
