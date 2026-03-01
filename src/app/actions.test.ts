import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({}),
  },
}));

const validSubscription = {
  endpoint: "https://fcm.googleapis.com/push/abc",
  keys: { p256dh: "key1", auth: "key2" },
};

describe("server actions", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
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
  });

  describe("unsubscribeUser", () => {
    it("returns success", async () => {
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

    it("returns error when no subscription is set", async () => {
      const { sendNotification } = await import("./actions");
      const result = await sendNotification("Hello");
      expect(result).toEqual({
        success: false,
        error: "No subscription available",
      });
    });

    it("sends notification after subscribing", async () => {
      vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "test-public-key");
      vi.stubEnv("VAPID_PRIVATE_KEY", "test-private-key");

      const { subscribeUser, sendNotification } = await import("./actions");

      const subResult = await subscribeUser(validSubscription);
      expect(subResult).toEqual({ success: true });

      const sendResult = await sendNotification("Hello world");
      expect(sendResult).toEqual({ success: true });

      const webpush = (await import("web-push")).default;
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

      vi.unstubAllEnvs();
    });

    it("returns error when rate limit is exceeded", async () => {
      vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "test-public-key");
      vi.stubEnv("VAPID_PRIVATE_KEY", "test-private-key");

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

      vi.unstubAllEnvs();
    });
  });

  describe("ensureVapidInitialized", () => {
    it("throws when VAPID keys are not configured", async () => {
      vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
      vi.stubEnv("VAPID_PRIVATE_KEY", "");

      const { subscribeUser, sendNotification } = await import("./actions");
      await subscribeUser(validSubscription);

      await expect(sendNotification("Hello")).rejects.toThrow(
        "VAPID keys are not configured"
      );

      vi.unstubAllEnvs();
    });
  });
});
