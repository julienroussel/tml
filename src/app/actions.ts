"use server";

import "server-only";
import webpush from "web-push";

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";

let vapidInitialized = false;
function ensureVapidInitialized() {
  if (!vapidInitialized) {
    if (!(publicKey && privateKey)) {
      throw new Error("VAPID keys are not configured");
    }
    webpush.setVapidDetails(
      "mailto:hello@themagiclab.app",
      publicKey,
      privateKey
    );
    vapidInitialized = true;
  }
}

// TODO: Replace in-memory state with persistent storage (e.g. database).
// This won't persist across serverless invocations and is shared across all
// users, which means only the last subscriber receives notifications.
let subscription: webpush.PushSubscription | null = null;

// Rate limiting for sendNotification
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10;
let rateLimitCount = 0;
let rateLimitReset = Date.now() + RATE_LIMIT_WINDOW;

// TODO: Add authentication before production use — without auth, any client
// can subscribe arbitrary push endpoints.
// biome-ignore lint/suspicious/useAwait: Next.js server actions must be async
export async function subscribeUser(
  sub: webpush.PushSubscription
): Promise<ActionResult> {
  if (!sub?.endpoint || typeof sub.endpoint !== "string") {
    return { success: false, error: "Invalid subscription" };
  }
  if (!sub.endpoint.startsWith("https://")) {
    return { success: false, error: "Invalid endpoint URL" };
  }
  if (!(sub.keys?.p256dh && sub.keys?.auth)) {
    return { success: false, error: "Invalid subscription keys" };
  }
  subscription = sub;
  return { success: true };
}

// TODO: Add authentication before production use — without auth, any client
// can unsubscribe other users.
// biome-ignore lint/suspicious/useAwait: Next.js server actions must be async
export async function unsubscribeUser(): Promise<ActionResult> {
  subscription = null;
  return { success: true };
}

// TODO: Add authentication before production use — without auth, any client
// can trigger push notifications to the stored subscriber.
export async function sendNotification(message: string): Promise<ActionResult> {
  const now = Date.now();
  if (now > rateLimitReset) {
    rateLimitCount = 0;
    rateLimitReset = now + RATE_LIMIT_WINDOW;
  }
  rateLimitCount++;
  if (rateLimitCount > RATE_LIMIT_MAX) {
    return { success: false, error: "Rate limit exceeded" };
  }

  if (!message.trim() || message.length > 1000) {
    return { success: false, error: "Invalid message" };
  }

  if (!subscription) {
    return { success: false, error: "No subscription available" };
  }

  ensureVapidInitialized();

  const payload = JSON.stringify({
    title: "The Magic Lab",
    body: message,
    icon: "/icon-192x192.png",
  });

  await webpush.sendNotification(subscription, payload);
  return { success: true };
}
