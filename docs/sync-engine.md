# Sync Engine

The Magic Lab uses PowerSync Cloud for offline-first data synchronization between the browser's local SQLite database and the server-side Neon Postgres instance.

## Architecture Overview

PowerSync provides bidirectional sync with an offline-first approach: the app reads and writes to a WASM-based SQLite database in the browser, and PowerSync Cloud handles replication to/from Neon Postgres in the background. Neon Postgres remains the source of truth, with last-write-wins conflict resolution.

```
Browser                    Cloud                    Database
+-------------------+     +------------------+     +------------------+
| React Components  |     | PowerSync Cloud  |     | Neon Postgres    |
|   useQuery()      |<----|   Sync Service   |<----|   (source of     |
|   execute()       |---->|                  |     |    truth)        |
|   Local SQLite    |     |                  |     |                  |
+-------------------+     +------------------+     +------------------+
                               |                         ^
                               |    Neon Data API        |
                               +-------------------------+
```

## Write Path

1. **User action** triggers a write in the React component
2. **`execute()`** writes to the local SQLite database immediately (instant UI update)
3. The write is placed in the **upload queue** (persisted locally)
4. The PowerSync connector uploads queued writes directly to the **Neon Data API** (`NEXT_PUBLIC_NEON_DATA_API_URL`)
5. Each CRUD operation is sent as a separate HTTP request with a Bearer token from Neon Auth
6. PowerSync receives confirmation and removes the item from the queue

```
Component
  |
  v
execute(sql)  -->  Local SQLite (immediate)
  |
  v
Upload Queue  -->  PowerSync Connector  -->  Neon Data API  -->  Neon Postgres
```

The connector (`src/sync/connector.ts`) handles:
- **PUT**: Upsert via `INSERT ... ON CONFLICT DO UPDATE`
- **PATCH**: Standard `UPDATE ... SET ... WHERE`
- **DELETE**: Soft-delete by setting `deleted_at` and `updated_at`

If the device is offline, writes accumulate in the upload queue and sync when connectivity resumes.

## Read Path

1. **PowerSync Cloud** watches the Neon Postgres replication stream for changes
2. Changes are pushed to connected clients via WebSocket
3. The **local SQLite** database is updated with incoming changes
4. **`useQuery()`** hooks automatically re-render components with fresh data

```
Neon  -->  PowerSync Cloud  -->  WebSocket  -->  Local SQLite  -->  useQuery()  -->  Component
```

## Conflict Resolution

The sync engine uses **Last-Write-Wins (LWW)** with `updated_at` timestamps:

- Every mutation sets `updated_at` to the current timestamp
- When two clients modify the same row, the write with the later `updated_at` wins
- PowerSync Cloud handles conflict detection and resolution automatically
- The LWW strategy is simple and predictable -- suitable for a single-user workspace

## FK Cascade and Sync

When the hard-delete cleanup job permanently removes parent rows (setlists, tricks), Postgres `ON DELETE SET NULL` cascades null out the FK columns on child rows (`performances.setlist_id`, `goals.trick_id`). These cascades:

1. **Are detected by PowerSync** via the Postgres WAL replication stream
2. **Bump `updated_at`** via database triggers (`bump_updated_at_on_fk_null`) to ensure correct LWW conflict resolution
3. **Require no client schema changes** -- PowerSync `column.text` is nullable by default

Without the `updated_at` trigger, a concurrent client write could win the LWW comparison with a stale timestamp, causing the cascade to be silently overwritten.

## Deletion Strategy

The app uses **soft-delete with tombstones** to ensure reliable sync:

1. **Soft-delete**: Setting `deleted_at` to the current timestamp marks a row as deleted
2. **Tombstone retention**: Deleted rows are retained for 30 days to ensure all clients receive the deletion
3. **Hard-delete cleanup**: Planned -- a scheduled job will permanently remove rows where `deleted_at` is older than 30 days (not yet implemented)
4. **UI filtering**: Queries exclude rows where `deleted_at IS NOT NULL` unless explicitly viewing deleted items

This approach ensures that:
- Offline clients receive deletion events when they reconnect
- Users can undo accidental deletions within the retention window
- The database does not grow unbounded with deleted rows

## PowerSync Client Setup

The PowerSync client is initialized with:

- **WASM SQLite** for the local database (runs in a Web Worker)
- **Schema definition** matching the server-side Drizzle schema — generated from `src/db/schema/` (see the Codegen section below)
- **JWT from Neon Auth** for authenticating with PowerSync Cloud — fetched client-side via `GET /api/auth/token` (a Better Auth endpoint served by the catch-all route at `src/app/api/auth/[...path]/route.ts`). The connector decodes the JWT `exp` claim and passes `expiresAt` to PowerSync so the SDK knows when to refresh credentials.

## Sync Streams

PowerSync sync streams (edition 3) define which rows each user can access. The Magic Lab uses a single `user_data` stream with `auto_subscribe: true`:

- Every synced table is filtered by `WHERE user_id = auth.user_id()` — `auth.user_id()` is evaluated from the signed JWT and cannot be spoofed by the client.
- Tenant isolation is enforced by PowerSync at sync time; the client only ever receives rows owned by the authenticated user.
- Sync streams are defined in `powersync/sync-config.yaml` — version-controlled, reviewed in PRs, and deployed automatically on merge to `main`. The PowerSync Cloud Dashboard is view-only.

## Codegen

Three sync artifacts are generated from the Drizzle server schema by `scripts/generate-sync.ts`:

| Artifact | Purpose |
|---|---|
| `powersync/sync-config.yaml` | Sync Streams config deployed to PowerSync Cloud |
| `src/sync/schema.ts` | PowerSync client schema (local SQLite) |
| `src/sync/synced-columns.ts` | `SYNCED_TABLE_NAMES` / `SYNCED_COLUMNS` allowlist used by the batch endpoint and connector |

Server-only tables (`users`, `user_preferences`, `push_subscriptions`) are excluded via the `SERVER_ONLY_TABLES` denylist inside the script. New tables sync by default — add to the denylist only if they must never reach the client.

- Run `pnpm sync:generate` after any change under `src/db/schema/**`.
- Commit all three generated files alongside the schema change.
- Never hand-edit the generated files; they carry a header comment warning of overwrites on the next regen.
- `pnpm sync:check` fails if the committed artifacts drift from the Drizzle schema. It runs as a pre-commit hook (Lefthook) and as a PR gate in CI.

## Deployment

Deployment flows through the PowerSync CLI (`powersync deploy sync-config`) via `.github/workflows/deploy-sync.yml`. The workflow runs on `push` to `main` only when sync-related paths change.

All env vars use a consistent `POWERSYNC_*` prefix. A thin wrapper (`scripts/powersync.ts`) maps them to the bare names the CLI expects at invocation time.

| Env var | Storage | Purpose |
|---|---|---|
| `POWERSYNC_ADMIN_TOKEN` | GitHub secret | Personal Access Token generated at https://dashboard.powersync.com/account/access-tokens |
| `POWERSYNC_INSTANCE_ID` | GitHub variable | PowerSync instance ID; discover locally via `powersync fetch instances` after `powersync login` |
| `POWERSYNC_PROJECT_ID` | GitHub variable | PowerSync project ID |
| `POWERSYNC_ORG_ID` | GitHub variable (optional) | Needed only if the PAT spans multiple organisations |

For local emergency deploys or first-time setup, run `POWERSYNC_ADMIN_TOKEN=... POWERSYNC_INSTANCE_ID=... POWERSYNC_PROJECT_ID=... pnpm sync:deploy`. `pnpm sync:validate` runs the CLI validator against `powersync/sync-config.yaml` — useful as a fast sanity check before pushing.

The CLI has no native rollback: revert the commit and re-run the workflow to restore a prior config. `powersync/cli.yaml` (the local link file) is git-ignored to keep instance IDs out of the repo.

## Offline Behavior

When the device is offline:

- **Reads** continue to work from local SQLite (no loading states)
- **Writes** are queued locally and applied immediately to the local database
- A **sync status indicator** shows the user that changes are pending
- When connectivity resumes, the upload queue drains automatically

## See Also

- [data-model.md](./data-model.md) -- Database schema
- [diagrams/sync-flow.md](./diagrams/sync-flow.md) -- Sequence diagram of the sync flow
- [auth-flow.md](./auth-flow.md) -- Token authentication for PowerSync
