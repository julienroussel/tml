# Sync Flow Diagram

Sequence diagram showing the offline-first data synchronization flow.

## Write Flow (Client to Server)

```mermaid
sequenceDiagram
    participant User
    participant Component as React Component
    participant SQLite as Local SQLite
    participant Queue as Upload Queue
    participant Connector as PowerSync Connector
    participant NeonAPI as Neon Data API
    participant Neon as Neon Postgres

    User->>Component: Create/update/delete
    Component->>SQLite: execute(sql)
    Note over SQLite: Immediate local write
    SQLite-->>Component: Updated data
    Component-->>User: Instant UI update

    SQLite->>Queue: Enqueue write
    Note over Queue: Persisted locally

    alt Online
        Queue->>Connector: getNextCrudTransaction()
        loop Each CRUD operation
            Connector->>NeonAPI: POST (SQL + Bearer token)
            NeonAPI->>Neon: Execute query
            Neon-->>NeonAPI: Result
            NeonAPI-->>Connector: 200 OK
        end
        Connector->>Queue: transaction.complete()
    else Offline
        Note over Queue: Writes accumulate<br/>until connectivity resumes
    end
```

## Read Flow (Server to Client)

```mermaid
sequenceDiagram
    participant Neon as Neon Postgres
    participant PS as PowerSync Cloud
    participant SQLite as Local SQLite
    participant Hook as useQuery()
    participant Component as React Component

    Note over Neon: Data changes<br/>(from any client)
    Neon->>PS: Replication stream
    PS->>SQLite: WebSocket push
    Note over SQLite: Update local tables
    SQLite->>Hook: Change notification
    Hook->>Component: Re-render with new data
```

## Multi-Client Sync

```mermaid
sequenceDiagram
    participant Client_A as Client A<br/>(Phone)
    participant SQLite_A as SQLite A
    participant PS as PowerSync Cloud
    participant Neon as Neon Postgres
    participant SQLite_B as SQLite B
    participant Client_B as Client B<br/>(Desktop)

    Client_A->>SQLite_A: Create trick
    SQLite_A->>PS: Upload via Neon Data API
    PS->>Neon: Write to Postgres
    Neon->>PS: Replication event
    PS->>SQLite_B: Push change
    SQLite_B->>Client_B: Re-render
    Note over Client_B: Trick appears<br/>automatically
```

## Conflict Resolution

```mermaid
sequenceDiagram
    participant A as Client A<br/>(offline)
    participant B as Client B<br/>(offline)
    participant PS as PowerSync Cloud
    participant Neon as Neon Postgres

    Note over A,B: Both clients edit<br/>the same trick offline

    A->>A: Update name<br/>updated_at = T1
    B->>B: Update name<br/>updated_at = T2 (later)

    Note over A,B: Both come online

    A->>PS: Upload (T1)
    PS->>Neon: Write (T1)
    B->>PS: Upload (T2)
    PS->>Neon: Write (T2)

    Note over Neon: T2 > T1<br/>Last-Write-Wins
    Note over Neon: Client B's change<br/>is the final state

    Neon->>PS: Replication
    PS->>A: Push final state
    PS->>B: Push final state
```
