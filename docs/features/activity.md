# Activity / Event Log

User-facing activity history + canonical product-analytics source. Records the domain actions each user performs in the app — CRUD on tricks/tags/items, settings changes, push subscription, and sign-up — then surfaces them on `/activity` (full timeline) and `/dashboard` (recent-activity card).

## Why this exists

`@vercel/analytics` (still in use) is great for marketing-funnel dashboards but does not give us:

- A queryable event store in our own database.
- A per-user history surface (so users can see "what have I done").
- Native offline capture — PWA users may act offline; SDK-based analytics drop those events.

The `event_log` table closes those gaps. It rides PowerSync's existing per-user sync stream, so events captured offline replay to Neon when the client reconnects.

## Table schema

`src/db/schema/event-log.ts`:

| Column        | Type                            | Notes                                              |
|---------------|---------------------------------|----------------------------------------------------|
| `id`          | `uuid` (PK)                     | Default `gen_random_uuid()`.                       |
| `user_id`     | `uuid` (FK → `users.id`)        | `ON DELETE CASCADE`.                               |
| `event_type`  | `text`                          | Dot-separated, e.g. `"trick.created"`.             |
| `entity_type` | `text` (nullable)               | `"trick" \| "tag" \| "item" \| "settings" \| ...`  |
| `entity_id`   | `uuid` (nullable, unenforced)   | Soft-pointer to the related entity.                |
| `payload`     | `jsonb` (default `{}`)          | Snapshot of human-readable fields + context.       |
| `source`      | `text` enum (`client`/`server`) | Default `"client"`.                                |
| `created_at`  | `timestamptz` (default NOW)     | The user-facing event time.                        |
| `updated_at`  | `timestamptz`                   | Standard convention; rows are immutable in practice. |
| `deleted_at`  | `timestamptz` (nullable)        | Soft-delete for GDPR; FK CASCADE handles account deletion. |

Indexes (partial, `WHERE deleted_at IS NULL`):

- `event_log_user_id_created_at_idx` on `(user_id, created_at)` — activity-feed query.
- `event_log_event_type_idx` on `(event_type, created_at)` — analytics filtering.

RLS is enabled with policy `event_log_rls_policy` scoping `USING/WITH CHECK` to `user_id = auth.user_id()::uuid`. The standard `set_updated_at` trigger is attached.

## Sync

`scripts/generate-sync.ts` introspects the Drizzle schema barrel and generates `src/sync/schema.ts` + `powersync/sync-config.yaml`. New tables sync by default. The generated rule is:

```yaml
- SELECT * FROM event_log WHERE user_id = auth.user_id()
```

`payload` is `jsonb` server-side and `column.text` client-side — PowerSync serialises jsonb as a JSON string. The hook `useEvents` (`src/features/activity/hooks/use-events.ts`) calls `JSON.parse` on it.

## Emission API

Two helpers, exported from `src/lib/events/`:

- **`logEvent(tx, args)`** — call inside an existing `db.writeTransaction(async (tx) => {...})` block on the client. Writes one row atomically with the surrounding action.
- **`logEventServer(db, args)`** — call from server actions, route handlers, and auth callbacks. Writes via Drizzle on Neon; the row syncs back to the client through PowerSync.

Both helpers take a discriminated `EventType` and a typed `EventPayload<T>` (see `src/lib/events/types.ts`). `entity_type` and `entity_id` are optional and used for activity-feed icon mapping.

### Dual-sink rule

Every domain mutation emits to **two** sinks: `trackEvent()` (`@vercel/analytics`, funnel dashboards) and `logEvent()` / `logEventServer()` (canonical history). Both calls live in the same mutation hook / server action and must be added together. `event_log` is the source of truth — Vercel Analytics is a convenience layer.

## Initial event taxonomy

| `event_type`                          | Where it's emitted                                                  |
|---------------------------------------|---------------------------------------------------------------------|
| `trick.created` / `.updated` / `.deleted` | `src/features/repertoire/hooks/use-trick-mutations.ts`            |
| `tag.created`                         | `src/features/repertoire/hooks/use-tag-mutations.ts`                |
| `item.created` / `.updated` / `.deleted` | `src/features/collect/hooks/use-item-mutations.ts`               |
| `settings.theme_changed`              | `src/app/(app)/settings/actions.ts` (server-emitted)                |
| `settings.locale_changed`             | `src/app/(app)/settings/actions.ts` (server-emitted)                |
| `notifications.subscribed` / `.unsubscribed` | `src/app/actions.ts` (server-emitted)                        |
| `auth.signed_up`                      | `src/auth/ensure-user.ts` on first row creation (server-emitted)    |

`auth.signed_in` and `auth.signed_out` are deferred to v1.1 — Neon Auth doesn't expose callbacks for those flows; they need a thin wrapper around `createAuthClient()` plus a `/api/events/auth` route handler.

## UI

- **`src/app/(app)/activity/page.tsx`** — `/activity` route, renders `<ActivityView />`.
- **`src/features/activity/components/activity-view.tsx`** — page view: filter by entity type + reactive list.
- **`src/features/activity/components/activity-list.tsx`** — `<ol>` timeline.
- **`src/features/activity/components/activity-item.tsx`** — single event row (icon + i18n label + relative time).
- **`src/features/activity/components/recent-activity-card.tsx`** — 5-row card embedded in `src/app/(app)/dashboard/page.tsx`.
- **`src/features/activity/lib/format-event.ts`** — turns a `ParsedEvent` into the i18n key + interpolation values.
- **`src/features/activity/hooks/use-events.ts`** — `useQuery`-based reactive read from local SQLite.

i18n keys live under the `activity.*` namespace in all 7 locale files (`src/i18n/messages/{en,fr,es,pt,it,de,nl}.json`).

## Aggregate analytics — canned SQL

All queries assume `WHERE deleted_at IS NULL` filters out account-deletion cleanup rows.

```sql
-- Events per day for the last 30 days
SELECT date_trunc('day', created_at) AS day, COUNT(*)
FROM event_log
WHERE deleted_at IS NULL
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY day
ORDER BY day DESC;

-- Top event types this week
SELECT event_type, COUNT(*) AS n
FROM event_log
WHERE deleted_at IS NULL
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY event_type
ORDER BY n DESC;

-- Most active users (last 30 days)
SELECT user_id, COUNT(*) AS events
FROM event_log
WHERE deleted_at IS NULL
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY user_id
ORDER BY events DESC
LIMIT 20;

-- Trick-creation funnel: per-user counts since signup
SELECT user_id,
       SUM(CASE WHEN event_type = 'auth.signed_up' THEN 1 ELSE 0 END) AS signups,
       SUM(CASE WHEN event_type = 'trick.created' THEN 1 ELSE 0 END) AS tricks_created
FROM event_log
WHERE deleted_at IS NULL
GROUP BY user_id
HAVING SUM(CASE WHEN event_type = 'auth.signed_up' THEN 1 ELSE 0 END) = 1
ORDER BY tricks_created DESC;
```

## Out of scope (for now)

- `auth.signed_in` / `auth.signed_out` — v1.1, requires `authClient` wrapper.
- Events for currently-disabled modules (practice/performance/goals/setlists/improve/train/plan/perform/enhance/admin) — added when those modules ship.
- In-app aggregate analytics dashboard — query Neon SQL for now.
- Per-user "Clear my activity history" setting — v2 (cascade-delete on account removal already covers core GDPR).
- Retention / TTL — keep forever for now; revisit at scale.
