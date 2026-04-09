# Module Dependencies Diagram

Feature module dependency graph showing how modules relate to each other and shared infrastructure.

```mermaid
graph TB
    subgraph Core["Core Infrastructure"]
        Auth["Auth<br/>(Better Auth)"]
        Sync["Sync Engine<br/>(PowerSync)"]
        DB["Database<br/>(Neon Postgres)"]
        Notify["Notifications<br/>(web-push + Resend)"]
        I18n["i18n<br/>(next-intl)"]
    end

    subgraph Library["Library"]
        Repertoire["Repertoire<br/>Tricks"]
        Collect["Collection<br/>Inventory"]
    end

    subgraph Lab["The Lab"]
        Improve["Improve<br/>Practice Sessions"]
        Train["Train<br/>Goals & Drills"]
        Plan["Plan<br/>Setlists"]
        Perform["Perform<br/>Performances"]
    end

    subgraph Insights["Insights"]
        Enhance["Enhance<br/>Insights"]
    end

    %% Core dependencies
    Auth --> Sync
    Sync --> DB
    Notify --> Auth

    %% Module to core
    Repertoire --> Sync
    Repertoire --> Auth
    Collect --> Sync
    Collect --> Auth
    Improve --> Sync
    Improve --> Auth
    Train --> Sync
    Train --> Auth
    Train --> Notify
    Plan --> Sync
    Plan --> Auth
    Perform --> Sync
    Perform --> Auth
    Enhance --> Sync
    Enhance --> Auth

    %% Module to shared domain (Repertoire)
    Improve --> Repertoire
    Train --> Repertoire
    Plan --> Repertoire
    Perform --> Repertoire
    Collect --> Repertoire

    %% Cross-module dependencies
    Improve -.->|"practice data"| Enhance
    Train -.->|"goal progress"| Enhance
    Perform -.->|"performance data"| Enhance
    Plan -.->|"setlists for shows"| Perform
    Collect -.->|"props used in"| Repertoire

    %% i18n is used by everything
    I18n -.->|"all modules"| Library
    I18n -.->|"all modules"| Lab
    I18n -.->|"all modules"| Insights

    style Core fill:#f3e5f5,stroke:#9c27b0
    style Library fill:#e8f5e9,stroke:#4caf50
    style Lab fill:#e3f2fd,stroke:#2196f3
    style Insights fill:#fff3e0,stroke:#ff9800
```

## Module Descriptions

| Module | Group | Purpose | Key Entities |
|---|---|---|---|
| **Repertoire** | Library | Manage trick library with tags and metadata | tricks, trick_tags |
| **Collection** | Library | Manage inventory of props and materials | items, item_tricks |
| **Improve** | Lab | Log practice sessions, track skill progress | practice_sessions, practice_session_tricks |
| **Train** | Lab | Set goals, create drills, build streaks | goals |
| **Plan** | Lab | Build setlists for shows | setlists, setlist_tricks |
| **Perform** | Lab | Log performances, review feedback | performances |
| **Enhance** | Insights | Analytics, insights, improvement suggestions | Reads from all modules |

## Central Entity: Tricks (Repertoire)

The `tricks` table (managed by the Repertoire module) is the central entity shared across modules:

- **Collection**: Items (props) are linked to tricks that use them
- **Improve**: Practice sessions reference tricks being practiced
- **Train**: Goals can target specific tricks
- **Plan**: Setlists are ordered collections of tricks
- **Perform**: (Indirect) Performances use setlists which contain tricks

## Data Flow

```
Library:  Collection (items) --> Repertoire (tricks) <-- Improve (practice)  :Lab
                                       ^
                                       |
                               Plan (setlists) --> Perform (shows)          :Lab
                                       ^
                                       |
                                 Train (goals)                              :Lab
                                       |
                                       v
                                Enhance (insights) <-- All modules          :Insights
```
