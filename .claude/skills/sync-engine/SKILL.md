---
name: sync-check
description: "Compare Drizzle server schema against PowerSync client schema to detect drift. Reports missing tables, missing columns, and type mismatches. Use when touching the data layer or after running migrations."
user-invocable: true
---

# Sync Schema Check

Run this skill to verify the Drizzle server schema and PowerSync client schema are in sync.

## Steps

### 1. Read both schemas
- **Server (Drizzle)**: Read all files in `src/db/schema/` — each `pgTable()` call defines a server table
- **Client (PowerSync)**: Read `src/sync/schema.ts` — each `new Table({...})` defines a client table

### 2. Compare tables
For each Drizzle table, check that a matching PowerSync table exists in the `appSchema`. Report:
- **Missing tables**: Drizzle tables with no PowerSync counterpart
- **Extra tables**: PowerSync tables with no Drizzle counterpart (may be intentional)

Skip these server-only tables (not synced to client):
- `users` — managed by auth provider
- `push_subscriptions` — server-side only
- `user_preferences` — server-side only

### 3. Compare columns
For each shared table, compare columns. Report:
- **Missing columns**: Drizzle columns not in PowerSync
- **Extra columns**: PowerSync columns not in Drizzle

### 4. Check type mapping
Drizzle-to-PowerSync type mapping:
| Drizzle type | PowerSync type |
|---|---|
| `uuid`, `text`, `varchar`, `timestamp`, `timestamptz`, `date` | `column.text` |
| `integer`, `smallint`, `boolean` | `column.integer` |
| `real`, `doublePrecision`, `numeric`, `decimal` | `column.real` |

Report any type mismatches.

### 5. Report results
Display a summary:
- Tables in sync (count)
- Missing from PowerSync (list with columns)
- Missing from Drizzle (list)
- Column mismatches (table + column + expected vs actual)

### 6. Fix (if requested)
If the user asks to fix drift, update `src/sync/schema.ts` to match the server schema, following PowerSync conventions:
- All IDs and timestamps → `column.text`
- Integers and booleans → `column.integer`
- Decimals → `column.real`

## Dual Schema Architecture
- **Server (Drizzle)**: `src/db/schema/` — Postgres tables via `pgTable()`
- **Client (PowerSync)**: `src/sync/schema.ts` — local SQLite via PowerSync's `column`/`Schema`/`Table` DSL
- Both schemas MUST stay in sync for offline-first to work correctly

## Column Requirements (every mutable row)
- `id` — UUID v7 (client-generated, implicit in PowerSync)
- `user_id` — FK to users.id
- `created_at` / `updated_at` — `timestamptz NOT NULL DEFAULT now()`
- `deleted_at` — `timestamptz | null` (soft-delete tombstone)
