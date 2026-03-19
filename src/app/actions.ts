"use server";

import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import webpush from "web-push";
import { auth } from "@/auth/server";
import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema/push-subscriptions";
import { checkRateLimit } from "@/lib/rate-limit";

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
  if (!sub.endpoint.startsWith("https://") || sub.endpoint.length > 2048) {
    return { success: false, error: "Invalid endpoint URL" };
  }

  try {
    const endpointUrl = new URL(sub.endpoint);
    const hostname = endpointUrl.hostname.toLowerCase();
    // Suffix entries start with a leading dot (e.g. ".push.apple.com"), so
    // `endsWith` already guarantees a label-boundary match — "evilpush.apple.com"
    // will NOT match ".push.apple.com". Deeply nested subdomains like
    // "a.b.push.apple.com" still match, but those are controlled by the
    // respective push-service operators (Apple, Microsoft), not by end users.
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
  try {
    const db = getDb();
    const result = await db
      .insert(pushSubscriptions)
      .values({
        userId: session.user.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        authKey: sub.keys.auth,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          p256dh: sub.keys.p256dh,
          authKey: sub.keys.auth,
          lastUsedAt: sql`NOW()`,
        },
        where: eq(pushSubscriptions.userId, session.user.id),
      })
      .returning({ id: pushSubscriptions.id });

    if (result.length === 0) {
      return { success: false, error: "Failed to save subscription" };
    }
  } catch (error: unknown) {
    console.error("Failed to save push subscription:", {
      userId: session.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to save subscription" };
  }

  return { success: true };
}

export async function unsubscribeUser(endpoint: string): Promise<ActionResult> {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return { success: false, error: "Not authenticated" };
  }

  if (!endpoint?.startsWith("https://") || endpoint.length > 2048) {
    return { success: false, error: "Invalid endpoint" };
  }

  try {
    const db = getDb();
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, session.user.id),
          eq(pushSubscriptions.endpoint, endpoint)
        )
      );
  } catch (error: unknown) {
    console.error("Failed to remove push subscription:", {
      userId: session.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to remove subscription" };
  }

  return { success: true };
}

function fetchUserSubscriptions(userId: string) {
  const db = getDb();
  return db
    .select({
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      authKey: pushSubscriptions.authKey,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
}

type SubscriptionRow = Awaited<
  ReturnType<typeof fetchUserSubscriptions>
>[number];

async function deliverToSubscriptions(
  subscriptions: SubscriptionRow[],
  payload: string
): Promise<{ anySuccess: boolean; goneEndpoints: string[] }> {
  const goneEndpoints: string[] = [];
  let anySuccess = false;

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.authKey },
        },
        payload
      )
    )
  );

  for (const [i, result] of results.entries()) {
    if (result.status === "fulfilled") {
      anySuccess = true;
    } else {
      const error: unknown = result.reason;
      if (isWebPushError(error) && error.statusCode === 410) {
        const sub = subscriptions[i];
        if (sub) {
          goneEndpoints.push(sub.endpoint);
        }
      }
      console.error("Failed to send push notification:", error);
    }
  }

  return { anySuccess, goneEndpoints };
}

async function cleanupGoneSubscriptions(
  endpoints: string[],
  userId: string
): Promise<void> {
  if (endpoints.length === 0) {
    return;
  }
  try {
    const db = getDb();
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          inArray(pushSubscriptions.endpoint, endpoints),
          eq(pushSubscriptions.userId, userId)
        )
      );
  } catch (cleanupError: unknown) {
    console.error("Failed to clean up stale subscriptions:", cleanupError);
  }
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

  if (await checkRateLimit(userId)) {
    return { success: false, error: "Rate limit exceeded" };
  }

  let subscriptions: SubscriptionRow[];
  try {
    subscriptions = await fetchUserSubscriptions(userId);
  } catch (error: unknown) {
    console.error("Failed to fetch push subscriptions:", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to send notification" };
  }

  if (subscriptions.length === 0) {
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

  const { anySuccess, goneEndpoints } = await deliverToSubscriptions(
    subscriptions,
    payload
  );

  if (goneEndpoints.length > 0) {
    await cleanupGoneSubscriptions(goneEndpoints, userId);
  }

  if (!anySuccess) {
    return { success: false, error: "Failed to send notification" };
  }

  return { success: true };
}
