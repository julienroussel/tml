# Notification System

## When to use this skill
When adding new notification types, modifying push/email behavior, or updating notification preferences.

## Architecture
- **Push**: web-push library, VAPID keys, stored in `push_subscriptions` table
- **Email**: Resend provider, React Email templates in `src/emails/`
- **Preferences**: `user_preferences` table (push_enabled, email_enabled, reminder schedule)

## Notification Types
1. `practice_reminder` — daily, triggered by cron, respects user timezone
2. `goal_milestone` — event-driven, checked when practice session logged
3. `pre_show_reminder` — triggered by cron based on upcoming performances
4. `system` — admin-triggered via dashboard

## Adding a New Notification Type
1. Add type to the notification type union
2. Create email template in `src/emails/<type>.tsx` (React Email component)
3. Add push notification payload builder
4. Add triggering logic (cron or event-driven)
5. Add preference toggle in user_preferences if user-configurable
6. Add translations for notification content

## Push Notification Flow
1. User opts in → browser prompt → subscription stored in `push_subscriptions`
2. Trigger event → fetch matching subscriptions → send via web-push
3. On 404/410 response → delete stale subscription
4. Cleanup: prune subscriptions with `last_used_at` > 90 days

## Email Flow
1. Trigger event → render React Email template
2. Send via Resend API
3. Include `List-Unsubscribe` header with signed JWT
4. Unsubscribe endpoint: `/api/email/unsubscribe?token=<jwt>`

## Permission UX
- Never show browser push prompt on first visit
- Show custom in-app prompt after first meaningful action
- Example: "Want a daily reminder to keep your streak going?"
- Only trigger native browser dialog on user consent
