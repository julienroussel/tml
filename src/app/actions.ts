"use server";

import "server-only";
import webpush from "web-push";
import { auth } from "@/auth/server";

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

export interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

function isWebPushError(error: unknown): error is { statusCode: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  );
}

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

function isValidBase64urlKey(key: string, expectedLength: number): boolean {
  return BASE64URL_PATTERN.test(key) && key.length === expectedLength;
}

// p256dh: 65 bytes uncompressed ECDH key = 88 chars base64url
// auth: 16 bytes authentication secret = 22 chars base64url
const P256DH_BASE64URL_LENGTH = 88;
const AUTH_BASE64URL_LENGTH = 22;

const ALLOWED_PUSH_HOSTS = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
];
const ALLOWED_PUSH_SUFFIXES = [
  ".push.apple.com",
  ".web.push.apple.com",
  ".notify.windows.com",
];

let vapidReady = false;
// setVapidDetails is idempotent, but the guard avoids repeated env lookups.
function ensureVapidInitialized(): void {
  if (vapidReady) {
    return;
  }
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!(publicKey && privateKey)) {
    throw new Error("VAPID keys are not configured");
  }
  webpush.setVapidDetails(
    "mailto:hello@themagiclab.app",
    publicKey,
    privateKey
  );
  vapidReady = true;
}

// WARNING: Per-user in-memory subscription map. Prevents cross-user leaks
// within the same instance, but subscriptions are lost on every Vercel
// serverless cold start — each invocation may land on a different isolate.
// TODO(critical): Migrate to the `push_subscriptions` database table
// (src/db/schema/push-subscriptions.ts) before enabling push in production.
// Without this, subscriptions are effectively useless in a serverless env.
const subscriptionsByUser = new Map<string, PushSubscriptionInput>();

// NOTE: In-memory rate limiting resets on serverless cold starts. For production
// hardening, replace with Redis/Upstash-based rate limiting. This provides
// basic protection against rapid repeated submissions within a single instance.
// TODO: Move to a shared store (e.g. Vercel KV, Upstash Redis) with per-user
// keys for reliable enforcement.
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10;

interface RateLimitEntry {
  count: number;
  reset: number;
}

const rateLimitsByUser = new Map<string, RateLimitEntry>();

function cleanupExpiredRateLimits(currentUserId: string, now: number): void {
  // Only clean up when the map grows beyond 100 entries to avoid
  // unnecessary iteration on every request. Serverless cold starts
  // naturally bound map size, so this is a soft safety net.
  if (rateLimitsByUser.size <= 100) {
    return;
  }
  for (const [key, entry] of rateLimitsByUser) {
    if (key !== currentUserId && now > entry.reset) {
      rateLimitsByUser.delete(key);
    }
  }
}

export async function subscribeUser(
  sub: PushSubscriptionInput
): Promise<ActionResult> {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return { success: false, error: "Not authenticated" };
  }

  if (!sub?.endpoint || typeof sub.endpoint !== "string") {
    return { success: false, error: "Invalid subscription" };
  }
  if (!sub.endpoint.startsWith("https://")) {
    return { success: false, error: "Invalid endpoint URL" };
  }

  try {
    const endpointUrl = new URL(sub.endpoint);
    const hostname = endpointUrl.hostname.toLowerCase();
    const isAllowed =
      ALLOWED_PUSH_HOSTS.includes(hostname) ||
      ALLOWED_PUSH_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
    if (!isAllowed) {
      return { success: false, error: "Invalid push endpoint" };
    }
  } catch {
    return { success: false, error: "Invalid push endpoint" };
  }

  if (!(sub.keys?.p256dh && sub.keys?.auth)) {
    return { success: false, error: "Invalid subscription keys" };
  }
  if (
    !(
      isValidBase64urlKey(sub.keys.p256dh, P256DH_BASE64URL_LENGTH) &&
      isValidBase64urlKey(sub.keys.auth, AUTH_BASE64URL_LENGTH)
    )
  ) {
    return { success: false, error: "Invalid subscription keys" };
  }
  subscriptionsByUser.set(session.user.id, sub);
  return { success: true };
}

export async function unsubscribeUser(): Promise<ActionResult> {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return { success: false, error: "Not authenticated" };
  }

  subscriptionsByUser.delete(session.user.id);
  return { success: true };
}

export async function sendNotification(message: string): Promise<ActionResult> {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return { success: false, error: "Not authenticated" };
  }

  const trimmedMessage = message.trim();
  if (!trimmedMessage || trimmedMessage.length > 1000) {
    return { success: false, error: "Invalid message" };
  }

  const userId = session.user.id;

  const now = Date.now();
  let rateLimit = rateLimitsByUser.get(userId);
  if (rateLimit && now > rateLimit.reset) {
    rateLimit = undefined;
  }
  if (!rateLimit) {
    rateLimit = { count: 0, reset: now + RATE_LIMIT_WINDOW };
    rateLimitsByUser.set(userId, rateLimit);
    cleanupExpiredRateLimits(userId, now);
  }
  rateLimit.count++;
  if (rateLimit.count > RATE_LIMIT_MAX) {
    return { success: false, error: "Rate limit exceeded" };
  }

  const subscription = subscriptionsByUser.get(userId);
  if (!subscription) {
    return { success: false, error: "No subscription available" };
  }

  try {
    ensureVapidInitialized();
  } catch {
    return { success: false, error: "Notification service unavailable" };
  }

  const payload = JSON.stringify({
    title: "The Magic Lab",
    body: trimmedMessage,
    icon: "/icon-192x192.png",
  });

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      },
      payload
    );
  } catch (error: unknown) {
    if (isWebPushError(error) && error.statusCode === 410) {
      subscriptionsByUser.delete(userId);
    }
    console.error("Failed to send push notification:", error);
    return { success: false, error: "Failed to send notification" };
  }

  return { success: true };
}
