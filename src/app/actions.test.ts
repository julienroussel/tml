import { afterEach, describe, expect, it, vi } from "vitest";
import type { PushSubscriptionInput } from "./actions";

interface MockSession {
  data: {
    user: { id: string } | null;
  };
}

const authenticatedSession: MockSession = {
  data: { user: { id: "test-user" } },
};

const unauthenticatedSession: MockSession = {
  data: { user: null },
};

vi.mock("server-only", () => ({}));
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({}),
  },
}));
vi.mock("@/auth/server", () => ({
  auth: {
    getSession: vi.fn().mockResolvedValue(authenticatedSession),
  },
}));

// p256dh: 88 chars base64url (65 bytes), auth: 22 chars base64url (16 bytes)
const validSubscription: PushSubscriptionInput = {
  endpoint: "https://fcm.googleapis.com/push/abc",
  keys: {
    p256dh:
      "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8p8REfWLkA",
    auth: "tBHItJI5svbpC7-M3xJrOw",
  },
};

function stubVapidEnv(): void {
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "test-public-key");
  vi.stubEnv("VAPID_PRIVATE_KEY", "test-private-key");
}

async function setupSubscribedUser(): Promise<{
  webpush: Awaited<typeof import("web-push")>;
  subscribeUser: typeof import("./actions")["subscribeUser"];
  sendNotification: typeof import("./actions")["sendNotification"];
  unsubscribeUser: typeof import("./actions")["unsubscribeUser"];
}> {
  stubVapidEnv();
  const webpush = (await import("web-push")).default;
  const actions = await import("./actions");
  await actions.subscribeUser(validSubscription);
  return { webpush, ...actions };
}

describe("server actions", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  describe("unauthenticated user rejection", () => {
    it("subscribeUser rejects unauthenticated users", async () => {
      const { auth } = await import("@/auth/server");
      vi.mocked(auth.getSession).mockResolvedValueOnce(unauthenticatedSession);

      const { subscribeUser } = await import("./actions");
      const result = await subscribeUser(validSubscription);
      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("unsubscribeUser rejects unauthenticated users", async () => {
      const { auth } = await import("@/auth/server");
      vi.mocked(auth.getSession).mockResolvedValueOnce(unauthenticatedSession);

      const { unsubscribeUser } = await import("./actions");
      const result = await unsubscribeUser();
      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });

    it("sendNotification rejects unauthenticated users", async () => {
      const { auth } = await import("@/auth/server");
      vi.mocked(auth.getSession).mockResolvedValueOnce(unauthenticatedSession);

      const { sendNotification } = await import("./actions");
      const result = await sendNotification("Hello");
      expect(result).toEqual({ success: false, error: "Not authenticated" });
    });
  });

  describe("subscribeUser", () => {
    it("accepts a valid subscription", async () => {
      const { subscribeUser } = await import("./actions");
      const result = await subscribeUser(validSubscription);
      expect(result).toEqual({ success: true });
    });

    it("returns error on missing endpoint", async () => {
      const { subscribeUser } = await import("./actions");
      const result = await subscribeUser({
        endpoint: "",
        keys: { p256dh: "k", auth: "k" },
      });
      expect(result).toEqual({
        success: false,
        error: "Invalid subscription",
      });
    });

    it("returns error on non-https endpoint", async () => {
      const { subscribeUser } = await import("./actions");
      const result = await subscribeUser({
        endpoint: "http://evil.com",
        keys: { p256dh: "k", auth: "k" },
      });
      expect(result).toEqual({
        success: false,
        error: "Invalid endpoint URL",
      });
    });

    it("returns error on missing p256dh key", async () => {
      const { subscribeUser } = await import("./actions");
      const result = await subscribeUser({
        endpoint: "https://fcm.googleapis.com/push/abc",
        keys: { p256dh: "", auth: "k" },
      });
      expect(result).toEqual({
        success: false,
        error: "Invalid subscription keys",
      });
    });

    it("returns error on missing auth key", async () => {
      const { subscribeUser } = await import("./actions");
      const result = await subscribeUser({
        endpoint: "https://fcm.googleapis.com/push/abc",
        keys: { p256dh: "k", auth: "" },
      });
      expect(result).toEqual({
        success: false,
        error: "Invalid subscription keys",
      });
    });

    it("rejects endpoints from disallowed hosts", async () => {
      const { subscribeUser } = await import("./actions");
      const result = await subscribeUser({
        endpoint: "https://evil.example.com/push",
        keys: { p256dh: "k", auth: "k" },
      });
      expect(result).toEqual({
        success: false,
        error: "Invalid push endpoint",
      });
    });

    it("accepts endpoints from suffix-matched hosts", async () => {
      const { subscribeUser } = await import("./actions");
      const result = await subscribeUser({
        endpoint: "https://web1.push.apple.com/some-token",
        keys: {
          p256dh: validSubscription.keys.p256dh,
          auth: validSubscription.keys.auth,
        },
      });
      expect(result).toEqual({ success: true });
    });

    it("rejects keys with invalid base64url format", async () => {
      const { subscribeUser } = await import("./actions");
      const result = await subscribeUser({
        endpoint: "https://fcm.googleapis.com/push/abc",
        keys: { p256dh: "short", auth: "short" },
      });
      expect(result).toEqual({
        success: false,
        error: "Invalid subscription keys",
      });
    });

    it("returns error for malformed endpoint URLs", async () => {
      const { subscribeUser } = await import("./actions");
      const result = await subscribeUser({
        endpoint: "https://not a valid url",
        keys: { p256dh: "k", auth: "k" },
      });
      expect(result).toEqual({
        success: false,
        error: "Invalid push endpoint",
      });
    });
  });

  describe("unsubscribeUser", () => {
    it("clears the subscription so sendNotification fails", async () => {
      const { subscribeUser, unsubscribeUser, sendNotification } = await import(
        "./actions"
      );
      const subResult = await subscribeUser(validSubscription);
      expect(subResult).toEqual({ success: true });

      const result = await unsubscribeUser();
      expect(result).toEqual({ success: true });

      const sendResult = await sendNotification("Hello");
      expect(sendResult).toEqual({
        success: false,
        error: "No subscription available",
      });
    });

    it("succeeds even without a prior subscription", async () => {
      const { unsubscribeUser } = await import("./actions");
      const result = await unsubscribeUser();
      expect(result).toEqual({ success: true });
    });
  });

  describe("sendNotification", () => {
    it("returns error on empty message", async () => {
      const { sendNotification } = await import("./actions");
      const result = await sendNotification("   ");
      expect(result).toEqual({ success: false, error: "Invalid message" });
    });

    it("returns error on message exceeding 1000 chars", async () => {
      const { sendNotification } = await import("./actions");
      const result = await sendNotification("a".repeat(1001));
      expect(result).toEqual({ success: false, error: "Invalid message" });
    });

    it("accepts a message at exactly 1000 chars", async () => {
      const { webpush, sendNotification } = await setupSubscribedUser();

      const message = "a".repeat(1000);
      const result = await sendNotification(message);
      expect(result).toEqual({ success: true });
      expect(webpush.sendNotification).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining(message)
      );
    });

    it("accepts whitespace-padded message where trimmed content is within limit", async () => {
      const { sendNotification } = await setupSubscribedUser();

      // 500 spaces + 500 chars + 500 spaces = 1500 untrimmed, 500 trimmed
      const paddedMessage = `${" ".repeat(500)}${"a".repeat(500)}${" ".repeat(500)}`;
      const result = await sendNotification(paddedMessage);
      expect(result).toEqual({ success: true });
    });

    it("rejects whitespace-padded message where trimmed content exceeds 1000 chars", async () => {
      const { sendNotification } = await import("./actions");

      const paddedMessage = `  ${"a".repeat(1001)}  `;
      const result = await sendNotification(paddedMessage);
      expect(result).toEqual({ success: false, error: "Invalid message" });
    });

    it("returns error when no subscription is set", async () => {
      const { sendNotification } = await import("./actions");
      const result = await sendNotification("Hello");
      expect(result).toEqual({
        success: false,
        error: "No subscription available",
      });
    });

    it("sends notification after subscribing", async () => {
      const { webpush, sendNotification } = await setupSubscribedUser();

      const sendResult = await sendNotification("Hello world");
      expect(sendResult).toEqual({ success: true });

      expect(webpush.setVapidDetails).toHaveBeenCalledWith(
        "mailto:hello@themagiclab.app",
        "test-public-key",
        "test-private-key"
      );
      expect(webpush.sendNotification).toHaveBeenCalledWith(
        validSubscription,
        JSON.stringify({
          title: "The Magic Lab",
          body: "Hello world",
          icon: "/icon-192x192.png",
        })
      );
    });

    it("returns error when webpush.sendNotification fails", async () => {
      const { webpush, sendNotification } = await setupSubscribedUser();

      vi.mocked(webpush.sendNotification).mockRejectedValueOnce(
        new Error("Push service unavailable")
      );

      const result = await sendNotification("Hello");
      expect(result).toEqual({
        success: false,
        error: "Failed to send notification",
      });
    });

    // NOTE: vi.resetModules() in afterEach ensures fresh module state between tests.
    // Rate limit tests use vi.useFakeTimers() BEFORE dynamic import so Date.now()
    // is controlled from the start. Do not remove resetModules or reorder tests.

    it("returns error when rate limit is exceeded", async () => {
      // Fake timers must be active before module import so that
      // rateLimitReset = Date.now() + RATE_LIMIT_WINDOW uses the faked clock.
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
      try {
        stubVapidEnv();

        const { subscribeUser, sendNotification } = await import("./actions");
        await subscribeUser(validSubscription);

        for (let i = 0; i < 10; i++) {
          const result = await sendNotification(`Message ${i}`);
          expect(result).toEqual({ success: true });
        }

        const result = await sendNotification("One too many");
        expect(result).toEqual({
          success: false,
          error: "Rate limit exceeded",
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it("invalid messages do not consume rate limit tokens", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
      try {
        stubVapidEnv();

        const { subscribeUser, sendNotification } = await import("./actions");
        await subscribeUser(validSubscription);

        // Send 10 invalid (empty) messages — validation rejects before rate limit
        for (let i = 0; i < 10; i++) {
          const result = await sendNotification("   ");
          expect(result).toEqual({ success: false, error: "Invalid message" });
        }

        // Valid message should still succeed — empty messages didn't count
        const result = await sendNotification("Valid message");
        expect(result).toEqual({ success: true });
      } finally {
        vi.useRealTimers();
      }
    });

    it("resets rate limit after 60 seconds", async () => {
      // Fake timers must be active before module import so that
      // rateLimitReset = Date.now() + RATE_LIMIT_WINDOW uses the faked clock.
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
      try {
        stubVapidEnv();

        const { subscribeUser, sendNotification } = await import("./actions");
        await subscribeUser(validSubscription);

        for (let i = 0; i < 10; i++) {
          const result = await sendNotification(`Message ${i}`);
          expect(result).toEqual({ success: true });
        }

        const rateLimitedResult = await sendNotification("One too many");
        expect(rateLimitedResult).toEqual({
          success: false,
          error: "Rate limit exceeded",
        });

        // Advance past the reset window (strict > check in source requires +1ms).
        vi.advanceTimersByTime(60_001);

        const afterResetResult = await sendNotification("After reset");
        expect(afterResetResult).toEqual({ success: true });
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("isWebPushError (via sendNotification behavior)", () => {
    it("recognizes an object with statusCode as a WebPushError", async () => {
      const { webpush, sendNotification } = await setupSubscribedUser();

      // Object with statusCode but not an Error instance — should still match
      const webPushLikeError = Object.assign(new Error("Gone"), {
        statusCode: 410,
      });
      vi.mocked(webpush.sendNotification).mockRejectedValueOnce(
        webPushLikeError
      );

      const result = await sendNotification("Hello");
      expect(result).toEqual({
        success: false,
        error: "Failed to send notification",
      });
    });

    it("handles plain Error without statusCode gracefully", async () => {
      const { webpush, sendNotification } = await setupSubscribedUser();

      vi.mocked(webpush.sendNotification).mockRejectedValueOnce(
        new Error("Network failure")
      );

      const result = await sendNotification("Hello");
      expect(result).toEqual({
        success: false,
        error: "Failed to send notification",
      });
    });

    it("handles string error gracefully", async () => {
      const { webpush, sendNotification } = await setupSubscribedUser();

      vi.mocked(webpush.sendNotification).mockRejectedValueOnce("string error");

      const result = await sendNotification("Hello");
      expect(result).toEqual({
        success: false,
        error: "Failed to send notification",
      });
    });

    it("handles null error gracefully", async () => {
      const { webpush, sendNotification } = await setupSubscribedUser();

      vi.mocked(webpush.sendNotification).mockRejectedValueOnce(null);

      const result = await sendNotification("Hello");
      expect(result).toEqual({
        success: false,
        error: "Failed to send notification",
      });
    });
  });

  describe("410 Gone auto-unsubscribe", () => {
    it("removes subscription when push service returns 410 Gone", async () => {
      const { webpush, sendNotification } = await setupSubscribedUser();

      const goneError = Object.assign(new Error("Gone"), { statusCode: 410 });
      vi.mocked(webpush.sendNotification).mockRejectedValueOnce(goneError);

      const result = await sendNotification("Hello");
      expect(result).toEqual({
        success: false,
        error: "Failed to send notification",
      });

      // Subsequent send should fail with "No subscription available" since
      // the 410 handler removed the subscription.
      const retryResult = await sendNotification("Retry");
      expect(retryResult).toEqual({
        success: false,
        error: "No subscription available",
      });
    });

    it("does not remove subscription on non-410 webpush errors", async () => {
      const { webpush, sendNotification } = await setupSubscribedUser();

      const serverError = Object.assign(new Error("Internal"), {
        statusCode: 500,
      });
      vi.mocked(webpush.sendNotification).mockRejectedValueOnce(serverError);

      const result = await sendNotification("Hello");
      expect(result).toEqual({
        success: false,
        error: "Failed to send notification",
      });

      // Subscription should still exist — next send should not fail with
      // "No subscription available".
      vi.mocked(webpush.sendNotification).mockResolvedValueOnce({} as never);
      const retryResult = await sendNotification("Retry");
      expect(retryResult).toEqual({ success: true });
    });
  });

  describe("ensureVapidInitialized", () => {
    it("calls setVapidDetails only once across multiple sendNotification calls", async () => {
      const { webpush, sendNotification } = await setupSubscribedUser();

      await sendNotification("First message");
      await sendNotification("Second message");

      expect(webpush.setVapidDetails).toHaveBeenCalledOnce();
    });

    it("returns error when VAPID keys are not configured", async () => {
      vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
      vi.stubEnv("VAPID_PRIVATE_KEY", "");

      const { subscribeUser, sendNotification } = await import("./actions");
      await subscribeUser(validSubscription);

      const result = await sendNotification("Hello");
      expect(result).toEqual({
        success: false,
        error: "Notification service unavailable",
      });
    });
  });
});
