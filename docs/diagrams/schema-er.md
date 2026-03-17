# Schema ER Diagram

Entity-relationship diagram for The Magic Lab database schema.

```mermaid
erDiagram
    users {
        uuid id PK "default random"
        text email UK
        text display_name
        text role "user, admin"
        text locale "default en"
        text theme "light, dark, system"
        timestamptz created_at
        timestamptz updated_at
    }

    tricks {
        uuid id PK "default random"
        uuid user_id FK
        text name
        text description
        text category
        integer difficulty
        text status "new, learning, performance_ready, mastered, shelved"
        text_arr tags
        text notes
        text source
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    routines {
        uuid id PK "default random"
        uuid user_id FK
        text name
        text description
        integer estimated_duration_minutes
        text_arr tags
        text language
        text environment "close_up, parlor, stage, any"
        text_arr requirements
        text notes
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    routine_tricks {
        uuid id PK "default random"
        uuid routine_id FK
        uuid trick_id FK
        integer position
        text transition_notes
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    practice_sessions {
        uuid id PK "default random"
        uuid user_id FK
        date date
        integer duration_minutes
        integer mood "1-5"
        text notes
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    practice_session_tricks {
        uuid id PK "default random"
        uuid practice_session_id FK
        uuid trick_id FK
        integer repetitions
        integer rating "1-5"
        text notes
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    performances {
        uuid id PK "default random"
        uuid user_id FK
        date date
        text venue
        text event_name
        uuid routine_id FK "nullable"
        integer audience_size
        text audience_type "birthday, corporate, other, private, street, theater, wedding"
        integer duration_minutes
        integer rating "1-5"
        text notes
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    items {
        uuid id PK "default random"
        uuid user_id FK
        text name
        text type "prop, book, gimmick, dvd, download, other"
        text description
        text brand
        text condition "new, good, worn, needs_repair"
        text location
        text notes
        date purchase_date
        numeric purchase_price
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    item_tricks {
        uuid id PK "default random"
        uuid item_id FK
        uuid trick_id FK
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    goals {
        uuid id PK "default random"
        uuid user_id FK
        text title
        text description
        text target_type "practice_streak, trick_mastery, show_count, custom"
        integer target_value
        integer current_value "default 0"
        date deadline
        timestamptz completed_at
        uuid trick_id FK "nullable"
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    push_subscriptions {
        uuid id PK "default random"
        uuid user_id FK
        text endpoint UK
        text p256dh
        text auth_key
        text device_name
        timestamptz created_at
        timestamptz last_used_at
    }

    user_preferences {
        uuid user_id PK_FK
        boolean push_enabled "default true"
        boolean email_enabled "default true"
        time practice_reminder_time
        text_arr practice_reminder_days
        boolean weekly_summary_enabled "default true"
        text timezone
        timestamptz updated_at
    }

    users ||--o{ tricks : "owns"
    users ||--o{ routines : "owns"
    users ||--o{ practice_sessions : "owns"
    users ||--o{ performances : "owns"
    users ||--o{ items : "owns"
    users ||--o{ goals : "owns"
    users ||--o{ push_subscriptions : "has"
    users ||--o| user_preferences : "has"

    routines ||--o{ routine_tricks : "contains"
    tricks ||--o{ routine_tricks : "used in"

    practice_sessions ||--o{ practice_session_tricks : "includes"
    tricks ||--o{ practice_session_tricks : "practiced in"

    performances ||--o| routines : "performed"

    items ||--o{ item_tricks : "used for"
    tricks ||--o{ item_tricks : "requires"

    tricks ||--o{ goals : "targeted by"
```
