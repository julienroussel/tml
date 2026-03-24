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
const mockIsUserBanned = vi.fn().mockResolvedValue(false);
vi.mock("@/auth/ban-check", () => ({
  isUserBanned: (...args: unknown[]) => mockIsUserBanned(...args),
}));
const mockCheckRateLimit = vi.fn().mockResolvedValue(false);
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
}));
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

const mockReturning = vi.fn().mockResolvedValue([{ id: "test-uuid" }]);
const mockOnConflictDoUpdate = vi.fn(() => ({ returning: mockReturning }));
const mockInsertValues = vi.fn(() => ({
  onConflictDoUpdate: mockOnConflictDoUpdate,
}));
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

const mockSelectWhere = vi.fn().mockResolvedValue([]);
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

vi.mock("@/db", () => ({
  getDb: () => ({
    insert: mockInsert,
    select: mockSelect,
    delete: mockDelete,
  }),
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

const validSubscriptionRow = {
  endpoint: validSubscription.endpoint,
  p256dh: validSubscription.keys.p256dh,
  authKey: validSubscription.keys.auth,
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
  mockSelectWhere.mockResolvedValue([validSubscriptionRow]);
  return { webpush, ...actions };
}

describe("server actions", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
    mockReturning.mockResolvedValue([{ id: "test-uuid" }]);
    mockCheckRateLimit.mockResolvedValue(false);
    mockIsUserBanned.mockResolvedValue(false);
    mockSelectWhere.mockResolvedValue([]);
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
      const result = await unsubscribeUser("https://example.com");
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

  describe("banned user rejection", () => {
    it("subscribeUser rejects banned users", async () => {
      mockIsUserBanned.mockResolvedValueOnce(true);

      const { subscribeUser } = await import("./actions");
      const result = await subscribeUser(validSubscription);
      expect(result).toEqual({ success: false, error: "Account suspended" });
    });

    it("unsubscribeUser rejects banned users", async () => {
      mockIsUserBanned.mockResolvedValueOnce(true);

      const { unsubscribeUser } = await import("./actions");
      const result = await unsubscribeUser(
        "https://fcm.googleapis.com/push/abc"
      );
      expect(result).toEqual({ success: false, error: "Account suspended" });
    });

    it("sendNotification rejects banned users", async () => {
      mockIsUserBanned.mockResolvedValueOnce(true);

      const { sendNotification } = await import("./actions");
      const result = await sendNotification("Hello");
      expect(result).toEqual({ success: false, error: "Account suspended" });
    });
  });

  describe("subscribeUser", () => {
    it("accepts a valid subscription", async () => {
      const { subscribeUser } = await import("./actions");
      const result = await subscribeUser(validSubscription);
      expect(result).toEqual({ success: true });
      expect(mockInsert).toHaveBeenCalled();
      expect(mockInsertValues).toHaveBeenCalledWith({
        userId: "test-user",
        endpoint: validSubscription.endpoint,
        p256dh: validSubscription.keys.p256dh,
        authKey: validSubscription.keys.auth,
      });
      expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.anything(),
          set: expect.objectContaining({
            p256dh: validSubscription.keys.p256dh,
            authKey: validSubscription.keys.auth,
          }),
          where: expect.anything(),
        })
      );
    });

    it("returns error when database insert fails", async () => {
      mockReturning.mockRejectedValueOnce(new Error("DB error"));
      const { subscribeUser } = await import("./actions");
      const result = await subscribeUser(validSubscription);
      expect(result).toEqual({
        success: false,
        error: "Failed to save subscription",
      });
    });

    it("returns error when endpoint is owned by another user", async () => {
      mockReturning.mockResolvedValueOnce([]);
      const { subscribeUser } = await import("./actions");
      const result = await subscribeUser(validSubscription);
      expect(result).toEqual({
        success: false,
        error: "Failed to save subscription",
      });
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
    it("deletes the subscription from the database", async () => {
      const { subscribeUser, unsubscribeUser, sendNotification } = await import(
        "./actions"
      );
      await subscribeUser(validSubscription);

      const result = await unsubscribeUser(validSubscription.endpoint);
      expect(result).toEqual({ success: true });
      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(mockDeleteWhere).toHaveBeenCalledTimes(1);

      // Select returns empty after unsubscribe (default mock)
      const sendResult = await sendNotification("Hello");
      expect(sendResult).toEqual({
        success: false,
        error: "No subscription available",
      });
    });

    it("returns error on empty endpoint", async () => {
      const { unsubscribeUser } = await import("./actions");
      const result = await unsubscribeUser("");
      expect(result).toEqual({ success: false, error: "Invalid endpoint" });
    });

    it("returns error on non-https endpoint", async () => {
      const { unsubscribeUser } = await import("./actions");
      const result = await unsubscribeUser("http://example.com/push");
      expect(result).toEqual({ success: false, error: "Invalid endpoint" });
    });

    it("returns error on endpoint exceeding length limit", async () => {
      const { unsubscribeUser } = await import("./actions");
      const longEndpoint = `https://fcm.googleapis.com/${"a".repeat(2048)}`;
      const result = await unsubscribeUser(longEndpoint);
      expect(result).toEqual({ success: false, error: "Invalid endpoint" });
    });

    it("succeeds even without a prior subscription", async () => {
      const { unsubscribeUser } = await import("./actions");
      const result = await unsubscribeUser("https://example.com/nonexistent");
      expect(result).toEqual({ success: true });
    });

    it("returns error when database delete fails", async () => {
      mockDeleteWhere.mockRejectedValueOnce(new Error("DB error"));
      const { unsubscribeUser } = await import("./actions");
      const result = await unsubscribeUser(validSubscription.endpoint);
      expect(result).toEqual({
        success: false,
        error: "Failed to remove subscription",
      });
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

    it("returns error when database select fails", async () => {
      stubVapidEnv();
      mockSelectWhere.mockRejectedValueOnce(new Error("DB error"));
      const { sendNotification } = await import("./actions");
      const result = await sendNotification("Hello");
      expect(result).toEqual({
        success: false,
        error: "Failed to send notification",
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
        {
          endpoint: validSubscription.endpoint,
          keys: {
            p256dh: validSubscription.keys.p256dh,
            auth: validSubscription.keys.auth,
          },
        },
        JSON.stringify({
          title: "The Magic Lab",
          body: "Hello world",
          icon: "/icon-192x192.png",
        })
      );
    });

    it("sends to multiple subscriptions", async () => {
      stubVapidEnv();
      const secondSub = {
        endpoint: "https://fcm.googleapis.com/push/def",
        p256dh: "second-p256dh",
        authKey: "second-auth",
      };
      mockSelectWhere.mockResolvedValue([validSubscriptionRow, secondSub]);

      const webpush = (await import("web-push")).default;
      const { sendNotification } = await import("./actions");

      const result = await sendNotification("Hello all devices");
      expect(result).toEqual({ success: true });
      expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    });

    it("returns success when at least one device succeeds", async () => {
      stubVapidEnv();
      const secondSub = {
        endpoint: "https://fcm.googleapis.com/push/def",
        p256dh: "second-p256dh",
        authKey: "second-auth",
      };
      mockSelectWhere.mockResolvedValue([validSubscriptionRow, secondSub]);

      const webpush = (await import("web-push")).default;
      const { sendNotification } = await import("./actions");

      const goneError = Object.assign(new Error("Gone"), { statusCode: 410 });
      vi.mocked(webpush.sendNotification)
        .mockResolvedValueOnce({} as never)
        .mockRejectedValueOnce(goneError);

      const result = await sendNotification("Partial");
      expect(result).toEqual({ success: true });
      // 410 endpoint should be cleaned up — exactly one delete with a WHERE clause
      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
    });

    it("returns success even when 410 cleanup fails", async () => {
      stubVapidEnv();
      const secondSub = {
        endpoint: "https://fcm.googleapis.com/push/def",
        p256dh: "second-p256dh",
        authKey: "second-auth",
      };
      mockSelectWhere.mockResolvedValue([validSubscriptionRow, secondSub]);

      const webpush = (await import("web-push")).default;
      const { sendNotification } = await import("./actions");

      const goneError = Object.assign(new Error("Gone"), { statusCode: 410 });
      vi.mocked(webpush.sendNotification)
        .mockResolvedValueOnce({} as never)
        .mockRejectedValueOnce(goneError);

      // Set up DB cleanup failure. This must be placed before sendNotification
      // because the 410 handler triggers the delete during that call.
      mockDeleteWhere.mockRejectedValueOnce(new Error("DB cleanup failed"));

      const consoleError = vi
        .spyOn(console, "error")
        // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress console.error output during test
        .mockImplementation(() => {});

      const result = await sendNotification("Hello");
      expect(result).toEqual({ success: true });
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to clean up stale subscriptions:",
        expect.any(Error)
      );
      consoleError.mockRestore();
    });

    it("returns error when all deliveries fail with non-410 errors", async () => {
      stubVapidEnv();
      const secondSub = {
        endpoint: "https://fcm.googleapis.com/push/def",
        p256dh: "second-p256dh",
        authKey: "second-auth",
      };
      mockSelectWhere.mockResolvedValue([validSubscriptionRow, secondSub]);

      const webpush = (await import("web-push")).default;
      const { sendNotification } = await import("./actions");

      const serverError = new Error("Internal Server Error");
      vi.mocked(webpush.sendNotification)
        .mockRejectedValueOnce(serverError)
        .mockRejectedValueOnce(serverError);

      const result = await sendNotification("Hello");
      expect(result).toEqual({
        success: false,
        error: "Failed to send notification",
      });
      // Non-410 errors should NOT trigger cleanup
      expect(mockDelete).not.toHaveBeenCalled();
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

    it("returns error when rate limit is exceeded", async () => {
      mockCheckRateLimit.mockResolvedValueOnce(true);
      const { sendNotification } = await setupSubscribedUser();
      const result = await sendNotification("Hello");
      expect(result).toEqual({
        success: false,
        error: "Rate limit exceeded",
      });
      expect(mockCheckRateLimit).toHaveBeenCalledWith("test-user");
    });

    it("does not check rate limit for invalid messages", async () => {
      const { sendNotification } = await import("./actions");
      await sendNotification("   ");
      expect(mockCheckRateLimit).not.toHaveBeenCalled();
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

      // Verify the 410 handler cleaned up the subscription via DB delete
      expect(mockDelete).toHaveBeenCalledTimes(1);

      // Subsequent send should fail with "No subscription available" since
      // the DB now returns empty.
      mockSelectWhere.mockResolvedValue([]);
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

      // Delete should NOT have been called for non-410 errors
      expect(mockDelete).not.toHaveBeenCalled();

      // Subscription should still exist — next send should succeed
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
      mockSelectWhere.mockResolvedValue([validSubscriptionRow]);

      const { subscribeUser, sendNotification } = await import("./actions");
      await subscribeUser(validSubscription);

      const result = await sendNotification("Hello");
      expect(result).toEqual({
        success: false,
        error: "Notification service unavailable",
      });
    });

    it("returns error when only public VAPID key is configured", async () => {
      vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "test-public-key");
      vi.stubEnv("VAPID_PRIVATE_KEY", "");
      mockSelectWhere.mockResolvedValue([validSubscriptionRow]);

      const { subscribeUser, sendNotification } = await import("./actions");
      await subscribeUser(validSubscription);
      const result = await sendNotification("Hello");
      expect(result).toEqual({
        success: false,
        error: "Notification service unavailable",
      });
    });

    it("returns error when only private VAPID key is configured", async () => {
      vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
      vi.stubEnv("VAPID_PRIVATE_KEY", "test-private-key");
      mockSelectWhere.mockResolvedValue([validSubscriptionRow]);

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
