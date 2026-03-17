# Database Migrations

The Magic Lab uses Drizzle ORM for database schema management and migrations against Neon Postgres.

## Migration Workflow

### 1. Define Schema

Schema is defined in TypeScript using Drizzle's schema API:

```typescript
// src/db/schema/tricks.ts
import { pgTable, text, integer, timestamp, uuid } from "drizzle-orm/pg-core";

export const tricks = pgTable("tricks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  difficulty: integer("difficulty"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
```

### 2. Generate Migration

```bash
pnpm drizzle-kit generate
```

This compares the current schema definitions with the last known state and generates a SQL migration file in `src/db/migrations/` (configured via `drizzle.config.ts`).

### 3. Review SQL

Always review the generated SQL before applying:

```bash
cat src/db/migrations/0001_add_tricks_table.sql
```

Check for:
- Destructive changes (column drops, type changes)
- Missing indexes
- Correct foreign key references
- Proper default values

### 4. Apply Migration

```bash
pnpm drizzle-kit migrate
```

This runs the pending migration(s) against the target database.

## Environment Strategy

### Development

- **Database**: Neon dev branch (isolated from production)
- **Workflow**: Iterate freely, reset branch if needed
- **Drizzle Studio**: Available in dev for visual schema inspection (`pnpm drizzle-kit studio`)

### Preview (PR Deployments)

- **Database**: Neon preview branch (created per PR via Vercel integration)
- **Workflow**: Migrations run automatically during Vercel build
- **Isolation**: Each PR gets its own database branch

### Production

- **Database**: Neon main branch
- **Workflow**: Migrations run during Vercel deployment build step
- **Safety**: Never run destructive migrations without a rollback plan

## Rollback Strategy

Drizzle does not generate automatic rollback migrations. The strategy is:

1. **Forward-fix**: Write a new migration that undoes the change
2. **Additive-first**: Prefer additive changes (new columns, new tables) over destructive ones
3. **Multi-step for breaking changes**:
   - Step 1: Add new column, backfill data
   - Step 2: Update application code to use new column
   - Step 3: Drop old column in a later migration

For emergencies:
- Neon supports **point-in-time restore** (PITR) to roll back to any point within the retention window
- Neon branches can be used to test rollback scenarios before applying to production

## Dual Schema Problem

The Magic Lab has two schema definitions that must stay in sync:

### Server Schema (Drizzle)

- Defined in `src/db/schema/*.ts`
- Used by Drizzle ORM for server-side queries
- Source of truth for Neon Postgres
- Generates SQL migrations

### Client Schema (PowerSync)

- Defined in `src/sync/schema.ts`
- Used by PowerSync for local SQLite
- Must mirror the server schema (column names, types)
- Does not support all Postgres types (e.g. no `uuid` type -- uses `text`)

### Keeping Schemas in Sync

1. **Server schema is the source of truth**: Always modify the Drizzle schema first
2. **Update PowerSync schema**: After generating a Drizzle migration, update the PowerSync schema to match
3. **Type mapping**: Postgres types map to SQLite types:

| Postgres | SQLite (PowerSync) |
|---|---|
| `uuid` | `text` |
| `text` | `text` |
| `integer` | `integer` |
| `numeric` | `real` |
| `timestamptz` | `text` (ISO 8601) |
| `boolean` | `integer` (0/1) |
| `date` | `text` (YYYY-MM-DD) |

4. **Validation**: A CI check (planned) compares both schemas and fails if they diverge

## Migration File Naming

Drizzle generates migration files with sequential prefixes:

```
src/db/migrations/
  0000_initial_schema.sql
  0001_add_tricks_table.sql
  0002_add_routines.sql
  ...
```

## See Also

- [data-model.md](./data-model.md) -- Complete schema documentation
- [sync-engine.md](./sync-engine.md) -- PowerSync sync architecture
- [local-development.md](./local-development.md) -- Dev database setup
