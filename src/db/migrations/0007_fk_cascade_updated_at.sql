-- Bump updated_at when a foreign key cascade sets a nullable FK column to NULL.
-- This ensures PowerSync's LWW conflict resolution works correctly when the
-- hard-delete cleanup job (#55) triggers ON DELETE SET NULL cascades.
--
-- Without this trigger, the cascade modifies the FK column but leaves updated_at
-- unchanged. A concurrent client write could then win the LWW comparison with a
-- stale timestamp, causing the server-side cascade to be silently overwritten.
--
-- The WHEN clause on each trigger ensures it only fires when the FK column
-- transitions from non-null to null. The guard inside the function
-- (NEW.updated_at = OLD.updated_at) prevents double-writes when the application
-- explicitly nulls the FK and sets updated_at in the same statement.

CREATE OR REPLACE FUNCTION bump_updated_at_on_fk_null()
RETURNS trigger AS $$
BEGIN
  IF NEW.updated_at = OLD.updated_at THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

-- performances.routine_id → routines.id (ON DELETE SET NULL)
CREATE OR REPLACE TRIGGER performances_fk_cascade_updated_at
  BEFORE UPDATE ON performances
  FOR EACH ROW
  WHEN (OLD.routine_id IS NOT NULL AND NEW.routine_id IS NULL)
  EXECUTE FUNCTION bump_updated_at_on_fk_null();--> statement-breakpoint

-- goals.trick_id → tricks.id (ON DELETE SET NULL)
CREATE OR REPLACE TRIGGER goals_fk_cascade_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW
  WHEN (OLD.trick_id IS NOT NULL AND NEW.trick_id IS NULL)
  EXECUTE FUNCTION bump_updated_at_on_fk_null();
