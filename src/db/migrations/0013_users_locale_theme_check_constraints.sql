-- Migration 0013: CHECK constraints for users.role, users.locale, and users.theme
--
-- Defense-in-depth: these text-enum columns are validated at the TypeScript
-- level by Drizzle's text({ enum: [...] }) and at runtime by isLocale() /
-- isTheme(), but no DB-level constraint existed. A buggy direct SQL write
-- could insert invalid values.

-- users.role: must be one of the 2 supported roles
ALTER TABLE users ADD CONSTRAINT users_role_valid
  CHECK (role IN ('user','admin')) NOT VALID;--> statement-breakpoint
ALTER TABLE users VALIDATE CONSTRAINT users_role_valid;--> statement-breakpoint

-- users.locale: must be one of the 7 supported locales
ALTER TABLE users ADD CONSTRAINT users_locale_valid
  CHECK (locale IN ('en','fr','es','pt','it','de','nl')) NOT VALID;--> statement-breakpoint
ALTER TABLE users VALIDATE CONSTRAINT users_locale_valid;--> statement-breakpoint

-- users.theme: must be one of the 3 supported themes
ALTER TABLE users ADD CONSTRAINT users_theme_valid
  CHECK (theme IN ('light','dark','system')) NOT VALID;--> statement-breakpoint
ALTER TABLE users VALIDATE CONSTRAINT users_theme_valid;
