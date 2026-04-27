---
name: migrations
description: "Run the full database migration workflow: modify Drizzle schema, generate migration SQL, review, apply to Neon, update PowerSync client schema, and regenerate docs. Use when adding/modifying/removing database tables or columns."
user-invocable: true
paths:
  - "src/db/schema/**"
  - "src/db/migrations/**"
  - "drizzle.config.ts"
---

# Database Migration Workflow

Run this skill when adding, modifying, or removing database tables or columns.

## Steps

### 1. Confirm the schema change
Ask the user what schema change is needed if not already clear. Review the current state:
- Server schema: `src/db/schema/` (Drizzle, Postgres)
- Client schema: `src/sync/schema.ts` (PowerSync, local SQLite)

### 2. Modify the Drizzle server schema
Edit files in `src/db/schema/`. Follow these conventions:
- UUID v7 primary keys (client-generated)
- `created_at` / `updated_at` / `deleted_at` on all mutable tables
- Branded ID types per entity (`TrickId`, `SetlistId`, etc.)
- Foreign keys reference `users.id` for row-level security
- Export new tables from `src/db/schema/index.ts`

### 3. Generate the migration
```bash
pnpm db:generate
```
This outputs a SQL migration file in `src/db/migrations/`.

### 4. Review the generated SQL
Read and display the generated SQL file. Ask the user to confirm before applying.

**Adding a column**: Make it NULLABLE first. Add NOT NULL constraint in a follow-up migration after backfill.
**Dropping a column (two-phase)**: Phase 1 — stop reading the column in code, deploy. Phase 2 — generate migration to drop column.

### 5. Apply the migration
```bash
pnpm db:migrate
```

### 6. Update PowerSync client schema
Edit `src/sync/schema.ts` to mirror the server changes. PowerSync uses `column.text`, `column.integer`, or `column.real`. All timestamps are `column.text` in PowerSync.

### 7. Regenerate docs
```bash
pnpm docs:generate
```

### 8. Verify
- Run `pnpm build` to check for type errors
- Run `pnpm test:run` to check for test failures

## Environment Behavior
- **Development**: Neon dev branch, `DATABASE_URL` in `.env.local`
- **Preview**: Neon preview branch per PR (auto-created by Vercel integration)
- **Production**: Migration runs during `pnpm build` step

## Rollback
- Drizzle does NOT auto-generate rollback SQL
- For non-trivial migrations, write a companion down migration manually
- Simple additions: rollback is "drop the column"
- Destructive changes: use two-phase approach
