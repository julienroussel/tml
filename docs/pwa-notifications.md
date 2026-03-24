# PWA & Push Notifications

The Magic Lab is a Progressive Web App with push notification support for practice reminders and goal tracking.

## PWA Setup

### Web App Manifest

The manifest is generated dynamically by `src/app/manifest.ts`:

- **id**: `/` (stable identity across start_url changes)
- **Name**: The Magic Lab
- **Short name**: Magic Lab
- **Display**: standalone (full-screen, no browser chrome)
- **Scope**: `/` (covers both marketing and app routes)
- **Orientation**: any
- **Language**: en (ltr)
- **Icons**: 192x192 and 512x512 PNG icons with maskable variant
- **Screenshots**: Desktop (1280x720) and mobile (390x844) for enhanced install prompt — regenerate with `pnpm screenshots`
- **Theme color**: `#ffffff` (manifest uses a single value; viewport meta tag provides light/dark variants)
- **Shortcuts**: "Log Practice" and "My Routines"

### Service Worker

The service worker (`public/sw.js`) handles:

1. **Static asset caching**: Cache-first for `/_next/static/` and `/@powersync/` (WASM, web workers)
2. **Navigation caching**: Stale-while-revalidate for HTML pages (offline fallback)
3. **Bypass rules**: Never caches API routes, PowerSync sync traffic, Neon Auth, or analytics
4. **Push notifications**: Receiving and displaying push messages
5. **Notification click**: Opening the app when a notification is tapped
6. **Installation**: Immediate activation via `skipWaiting()` and `clients.claim()`
7. **Cache cleanup**: Removes stale caches on activate, supports `clear-user-cache` message

### Service Worker Registration

The service worker is automatically registered by the `ServiceWorkerRegistration` component (`src/components/sw-registration.tsx`), which is mounted in the root layout (`src/app/layout.tsx`). This ensures the SW is active on all routes (marketing, auth, and app).

Registration is deferred until after `window.load` to avoid competing with initial page resources.

## Push Notifications

### Architecture

```
App Server                  Push Service              Browser
+----------------+         +----------------+        +----------------+
| API Route      |         | Web Push       |        | Service Worker |
| (web-push lib) |-------->| (FCM/APNs/     |------->| push event     |
|                |         |  Mozilla Push)  |        | showNotification|
+----------------+         +----------------+        +----------------+
```

### VAPID Keys

Push notifications use VAPID (Voluntary Application Server Identification):

- **Public key**: Shared with the client for subscription
- **Private key**: Used server-side to sign push messages
- Keys are stored as environment variables: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`

### Subscription Flow

1. User grants notification permission (browser prompt)
2. Client calls `pushManager.subscribe()` with the VAPID public key
3. Subscription data (endpoint, p256dh, auth) sent to the server via a server action
4. Server currently stores subscriptions in an **in-memory map** (per-instance, lost on cold start). A persistent storage migration to the `push_subscriptions` table is planned for production use.

### push_subscriptions Table

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key, default random |
| user_id | UUID | FK to users, cascade delete |
| endpoint | text | NOT NULL, unique, push service endpoint URL |
| p256dh | text | NOT NULL, client public key |
| auth_key | text | NOT NULL, auth secret |
| device_name | text | Browser/device info |
| created_at | timestamptz | NOT NULL, default now() |
| last_used_at | timestamptz | NOT NULL, default now() |

### Sending Notifications

The server uses the `web-push` library to send notifications:

```typescript
import webPush from "web-push";

await webPush.sendNotification(subscription, JSON.stringify({
  title: "Time to practice!",
  body: "You have a daily practice goal waiting.",
  icon: "/icon-192x192.png",
}));
```

### Notification Types (Planned)

| Type | Trigger | Description |
|---|---|---|
| Practice reminder | Scheduled | Daily/weekly practice nudge |
| Goal deadline | Time-based | Upcoming goal due date |
| Streak alert | Inactivity | "Don't break your streak!" |
| Achievement | Event | Milestone reached (e.g. 100 sessions) |

### Permission UX

Best practices for requesting notification permission:

1. **Do not prompt immediately** on first visit
2. Show an in-app banner explaining the benefit first
3. Only trigger the browser permission prompt after the user opts in
4. Provide a way to manage/disable notifications in Settings
5. Gracefully degrade if permission is denied

## Email Fallback (Planned)

For users who decline push notifications or are on unsupported platforms:

- **Provider**: Resend (transactional email service)
- **Templates**: Same notification types as push, formatted as emails
- **Preference**: Users choose push, email, both, or neither in Settings
- **Frequency**: Digest option to batch notifications into a daily/weekly email

## See Also

- [architecture.md](./architecture.md) -- Overall architecture
- [diagrams/notification-flow.md](./diagrams/notification-flow.md) -- Notification flow diagram
- [local-development.md](./local-development.md) -- Testing push notifications locally
