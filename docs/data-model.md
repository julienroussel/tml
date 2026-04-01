# Data Model

This document describes the database schema for The Magic Lab, stored in Neon Postgres and synced to client-side SQLite via PowerSync.

## Design Principles

- **UUID primary keys**: Generated via `defaultRandom()`, globally unique, no sequential leaks
- **Branded ID types**: TypeScript branded types (`UserId`, `TrickId`, etc.) prevent accidental ID mixing at compile time
- **Soft-delete**: All user-facing tables use a `deleted_at` timestamp instead of hard deletes, enabling sync tombstones and undo
- **Sync metadata**: Every synced table includes `created_at`, `updated_at`, and `deleted_at` columns for conflict resolution and change tracking
- **Tenant isolation**: All user data is scoped by `user_id` foreign key

## Tables

### users

Application user profile. Synced from Neon Auth (`neon_auth.user`) on sign-up. Server-only — not synced to PowerSync.

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | Branded as `UserId` |
| email | text | NOT NULL |
| display_name | text | |
| role | text | `"user"` or `"admin"`, default `"user"` |
| locale | text | ISO 639-1, default `"en"` |
| theme | text | `"light"`, `"dark"`, or `"system"`, default `"system"` |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |

### tricks

A trick, sleight, move, or technique in the magician's repertoire.

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | Branded as `TrickId` |
| user_id | UUID (FK -> users) | NOT NULL, cascade delete |
| name | text | NOT NULL |
| description | text | |
| category | text | e.g. "card", "coin", "mentalism" |
| effect_type | text | The magical effect: vanish, production, transformation, etc. |
| difficulty | integer | 1-5 scale |
| status | text | `"new"`, `"learning"`, `"performance_ready"`, `"mastered"`, `"shelved"`, default `"new"` |
| duration | integer | Estimated performance time in seconds |
| performance_type | text | `"close_up"`, `"parlor"`, `"stage"`, `"street"`, `"virtual"` |
| angle_sensitivity | text | `"none"`, `"slight"`, `"moderate"`, `"high"` |
| props | text | Quick-note for materials/equipment needed |
| music | text | Track name/description, null = no music |
| languages | text[] | Languages the trick can be performed in |
| is_camera_friendly | boolean | Can be performed on camera |
| is_silent | boolean | Can be performed without speaking |
| notes | text | Personal notes |
| source | text | Where the trick was learned |
| video_url | text | Reference video URL |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |
| deleted_at | timestamptz | Soft-delete |

### tags

User-defined tags for organizing tricks (and future entities). Shared across the whole app.

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | Branded as `TagId` |
| user_id | UUID (FK -> users) | NOT NULL, cascade delete |
| name | text | NOT NULL, normalized (trimmed, lowercased) |
| color | text | Hex color (e.g. `"#7c3aed"`) for visual grouping |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |
| deleted_at | timestamptz | Soft-delete |

Unique constraint on `(user_id, lower(name))` where `deleted_at IS NULL`.

### trick_tags

Join table linking tags to tricks (many-to-many).

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| user_id | UUID (FK -> users) | NOT NULL, cascade delete |
| trick_id | UUID (FK -> tricks) | NOT NULL, cascade delete |
| tag_id | UUID (FK -> tags) | NOT NULL, cascade delete |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |
| deleted_at | timestamptz | Soft-delete |

Unique constraint on `(trick_id, tag_id)` where `deleted_at IS NULL`.

### setlists

An ordered collection of tricks forming a performable setlist.

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | Branded as `SetlistId` |
| user_id | UUID (FK -> users) | NOT NULL, cascade delete |
| name | text | NOT NULL |
| description | text | |
| estimated_duration_minutes | integer | |
| tags | text[] | Free-form tags for organization |
| language | text | Patter language (ISO 639-1, null = language-independent) |
| environment | text | `"close_up"`, `"parlor"`, `"stage"`, `"any"` |
| requirements | text[] | Structured constraint tags (see below) |
| notes | text | |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |
| deleted_at | timestamptz | Soft-delete |

#### Setlist Requirements

The `requirements` column stores structured constraint tags used for show planning and compatibility checks:

| Requirement | Description |
|---|---|
| `needs_camera` | Requires camera/video projection (stage shows) |
| `needs_table` | Requires a close-up mat or table |
| `needs_assistant` | Requires a volunteer or assistant on stage |
| `audience_participation` | Requires spectator interaction |
| `impromptu` | No setup needed, can perform anywhere |
| `angle_sensitive` | Cannot be performed surrounded |
| `needs_mic` | Patter-heavy, needs amplification for larger venues |
| `reset_required` | Needs reset time between performances |

### setlist_tricks

Join table linking tricks to setlists with ordering.

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| setlist_id | UUID (FK -> setlists) | NOT NULL, cascade delete |
| trick_id | UUID (FK -> tricks) | NOT NULL, cascade delete |
| position | integer | NOT NULL, display order (unique per setlist) |
| transition_notes | text | Notes on transitioning into this trick |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |
| deleted_at | timestamptz | Soft-delete |

### practice_sessions

A logged practice session.

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | Branded as `PracticeSessionId` |
| user_id | UUID (FK -> users) | NOT NULL, cascade delete |
| date | date | NOT NULL |
| duration_minutes | integer | NOT NULL |
| mood | integer | 1-5 self-rating |
| notes | text | |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |
| deleted_at | timestamptz | Soft-delete |

### practice_session_tricks

Tricks practiced within a session, with per-trick feedback.

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| practice_session_id | UUID (FK -> practice_sessions) | NOT NULL, cascade delete |
| trick_id | UUID (FK -> tricks) | NOT NULL, cascade delete |
| repetitions | integer | Number of reps |
| rating | integer | 1-5 self-assessment |
| notes | text | |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |
| deleted_at | timestamptz | Soft-delete |

### performances

A logged performance or show.

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | Branded as `PerformanceId` |
| user_id | UUID (FK -> users) | NOT NULL, cascade delete |
| date | date | NOT NULL |
| venue | text | |
| event_name | text | Show/event name |
| setlist_id | UUID (FK -> setlists) | Optional, set null on setlist delete (trigger bumps `updated_at`) |
| audience_size | integer | |
| audience_type | text | `"birthday"`, `"corporate"`, `"other"`, `"private"`, `"street"`, `"theater"`, `"wedding"` |
| duration_minutes | integer | |
| rating | integer | 1-5 self-assessment |
| notes | text | |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |
| deleted_at | timestamptz | Soft-delete |

### items

Props, books, gimmicks, and other collectible items.

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | Branded as `ItemId` |
| user_id | UUID (FK -> users) | NOT NULL, cascade delete |
| name | text | NOT NULL |
| type | text | NOT NULL: `"prop"`, `"book"`, `"gimmick"`, `"dvd"`, `"download"`, `"other"` |
| description | text | |
| brand | text | Manufacturer/creator |
| condition | text | `"new"`, `"good"`, `"worn"`, `"needs_repair"` |
| location | text | Storage location |
| notes | text | |
| purchase_date | date | |
| purchase_price | numeric(10,2) | |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |
| deleted_at | timestamptz | Soft-delete |

### item_tricks

Join table linking items (props) to tricks that use them.

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| item_id | UUID (FK -> items) | NOT NULL, cascade delete |
| trick_id | UUID (FK -> tricks) | NOT NULL, cascade delete |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |
| deleted_at | timestamptz | Soft-delete |

Unique constraint on `(item_id, trick_id)`.

### goals

Practice goals and training objectives.

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | Branded as `GoalId` |
| user_id | UUID (FK -> users) | NOT NULL, cascade delete |
| title | text | NOT NULL |
| description | text | |
| target_type | text | `"practice_streak"`, `"trick_mastery"`, `"show_count"`, `"custom"` |
| target_value | integer | |
| current_value | integer | Default 0 |
| deadline | date | |
| completed_at | timestamptz | |
| trick_id | UUID (FK -> tricks) | Optional, set null on trick delete (trigger bumps `updated_at`) |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |
| deleted_at | timestamptz | Soft-delete |

### push_subscriptions

Web Push API subscription data. Server-only — not synced to PowerSync.

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | Default random |
| user_id | UUID (FK -> users) | NOT NULL, cascade delete |
| endpoint | text | NOT NULL, unique |
| p256dh | text | NOT NULL, client public key |
| auth_key | text | NOT NULL, auth secret |
| device_name | text | Browser/device info |
| created_at | timestamptz | NOT NULL, default now() |
| last_used_at | timestamptz | NOT NULL, default now() |

### user_preferences

Per-user application settings. Server-only — not synced to PowerSync.

| Column | Type | Notes |
|---|---|---|
| user_id | UUID (PK, FK -> users) | Cascade delete |
| push_enabled | boolean | Default true |
| email_enabled | boolean | Default true |
| practice_reminder_time | time | |
| practice_reminder_days | text[] | |
| weekly_summary_enabled | boolean | Default true |
| timezone | text | IANA timezone |
| updated_at | timestamptz | NOT NULL, default now() |

## Sync Scope

Not all tables are synced to the client via PowerSync:

| Table | Synced | Notes |
|---|---|---|
| tricks | Yes | Filtered by `user_id` |
| tags | Yes | Filtered by `user_id` |
| trick_tags | Yes | Filtered by `user_id` |
| setlists | Yes | Filtered by `user_id` |
| setlist_tricks | Yes | Global bucket (no `user_id`) |
| practice_sessions | Yes | Filtered by `user_id` |
| practice_session_tricks | Yes | Global bucket (no `user_id`) |
| performances | Yes | Filtered by `user_id` |
| items | Yes | Filtered by `user_id` |
| item_tricks | Yes | Global bucket (no `user_id`) |
| goals | Yes | Filtered by `user_id` |
| users | No | Server-only, managed by Neon Auth |
| user_preferences | No | Server-only |
| push_subscriptions | No | Server-only |

## Entity-Relationship Diagram

See [diagrams/schema-er.md](./diagrams/schema-er.md) for the full Mermaid ER diagram.

## Branded ID Types

```typescript
type UserId = string & { readonly __brand: "UserId" };
type TrickId = string & { readonly __brand: "TrickId" };
type SetlistId = string & { readonly __brand: "SetlistId" };
type PracticeSessionId = string & { readonly __brand: "PracticeSessionId" };
type PerformanceId = string & { readonly __brand: "PerformanceId" };
type ItemId = string & { readonly __brand: "ItemId" };
type GoalId = string & { readonly __brand: "GoalId" };
type TagId = string & { readonly __brand: "TagId" };
```

These types prevent accidentally passing a `TrickId` where a `SetlistId` is expected, catching errors at compile time rather than runtime.
