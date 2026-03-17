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

    subgraph Modules["Feature Modules"]
        Improve["Improve<br/>Practice Sessions"]
        Train["Train<br/>Goals & Drills"]
        Plan["Plan<br/>Routines & Sets"]
        Perform["Perform<br/>Performances"]
        Enhance["Enhance<br/>Insights"]
        Collect["Collect<br/>Inventory"]
    end

    subgraph Shared["Shared Domain"]
        Tricks["Tricks<br/>(repertoire)"]
    end

    %% Core dependencies
    Auth --> Sync
    Sync --> DB
    Notify --> Auth

    %% Module to core
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
    Collect --> Sync
    Collect --> Auth

    %% Module to shared domain
    Improve --> Tricks
    Train --> Tricks
    Plan --> Tricks
    Perform --> Tricks
    Collect --> Tricks

    %% Cross-module dependencies
    Improve -.->|"practice data"| Enhance
    Train -.->|"goal progress"| Enhance
    Perform -.->|"performance data"| Enhance
    Plan -.->|"routines for shows"| Perform
    Collect -.->|"props used in"| Tricks

    %% i18n is used by everything
    I18n -.->|"all modules"| Modules

    style Core fill:#f3e5f5,stroke:#9c27b0
    style Modules fill:#e3f2fd,stroke:#2196f3
    style Shared fill:#fff3e0,stroke:#ff9800
```

## Module Descriptions

| Module | Purpose | Key Entities |
|---|---|---|
| **Improve** | Log practice sessions, track skill progress | practice_sessions, practice_session_tricks |
| **Train** | Set goals, create drills, build streaks | goals |
| **Plan** | Build routines and setlists | routines, routine_tricks |
| **Perform** | Log performances, review feedback | performances |
| **Enhance** | Analytics, insights, improvement suggestions | Reads from all modules |
| **Collect** | Manage inventory of props and materials | items, item_tricks |

## Shared Domain: Tricks

The `tricks` table is the central entity shared across modules:

- **Improve**: Practice sessions reference tricks being practiced
- **Train**: Goals can target specific tricks
- **Plan**: Routines are ordered collections of tricks
- **Perform**: (Indirect) Performances use routines which contain tricks
- **Collect**: Items (props) are linked to tricks that use them

## Data Flow

```
Collect (items) --> Tricks <-- Improve (practice)
                      ^
                      |
              Plan (routines) --> Perform (shows)
                      ^
                      |
                Train (goals)
                      |
                      v
                Enhance (insights) <-- All modules
```
