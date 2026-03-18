import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockSend = vi.fn();

vi.mock("resend", () => {
  function MockResend() {
    return { emails: { send: mockSend } };
  }
  return { Resend: MockResend };
});

const HEX_64_PATTERN = /^[0-9a-f]{64}$/;
const UNSUBSCRIBE_URL_PATTERN =
  /^<https:\/\/themagiclab\.app\/api\/email\/unsubscribe\?token=/;
const PERSONALIZED_GREETING_PATTERN = /Hi \w+,/;

const TEST_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const TEST_USER_ID_2 = "b2c3d4e5-f6a7-8901-bcde-f12345678901";

describe("email", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  describe("createUnsubscribeToken", () => {
    it("produces a token in userId.timestamp.hmac format", async () => {
      vi.stubEnv("EMAIL_HMAC_SECRET", "test-secret-that-is-at-least-32-chars!");

      const { createUnsubscribeToken } = await import("@/lib/email");
      const token = createUnsubscribeToken(TEST_USER_ID);

      expect(token).toContain(`${TEST_USER_ID}.`);
      const parts = token.split(".");
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe(TEST_USER_ID);
      expect(Number(parts[1])).toBeGreaterThan(0);
      expect(parts[2]).toMatch(HEX_64_PATTERN);
    });

    it("produces identical tokens when called at the same second", async () => {
      vi.stubEnv("EMAIL_HMAC_SECRET", "test-secret-that-is-at-least-32-chars!");
      vi.useFakeTimers({ now: new Date("2026-01-01T00:00:00Z") });

      try {
        const { createUnsubscribeToken } = await import("@/lib/email");
        const token1 = createUnsubscribeToken(TEST_USER_ID);
        const token2 = createUnsubscribeToken(TEST_USER_ID);

        expect(token1).toBe(token2);
      } finally {
        vi.useRealTimers();
      }
    });

    it("produces different tokens for different users", async () => {
      vi.stubEnv("EMAIL_HMAC_SECRET", "test-secret-that-is-at-least-32-chars!");

      const { createUnsubscribeToken } = await import("@/lib/email");
      const token1 = createUnsubscribeToken(TEST_USER_ID);
      const token2 = createUnsubscribeToken(TEST_USER_ID_2);

      expect(token1).not.toBe(token2);
    });

    it("throws when EMAIL_HMAC_SECRET is missing", async () => {
      vi.stubEnv("EMAIL_HMAC_SECRET", "");

      const { createUnsubscribeToken } = await import("@/lib/email");
      expect(() => createUnsubscribeToken(TEST_USER_ID)).toThrow(
        "EMAIL_HMAC_SECRET environment variable is required"
      );
    });

    it("throws when EMAIL_HMAC_SECRET is too short", async () => {
      vi.stubEnv("EMAIL_HMAC_SECRET", "short");

      const { createUnsubscribeToken } = await import("@/lib/email");
      expect(() => createUnsubscribeToken(TEST_USER_ID)).toThrow(
        "EMAIL_HMAC_SECRET must be at least 32 characters"
      );
    });
  });

  describe("verifyUnsubscribeToken", () => {
    it("accepts a valid token and returns the userId", async () => {
      vi.stubEnv("EMAIL_HMAC_SECRET", "test-secret-that-is-at-least-32-chars!");

      const { createUnsubscribeToken, verifyUnsubscribeToken } = await import(
        "@/lib/email"
      );
      const token = createUnsubscribeToken(TEST_USER_ID);
      const result = verifyUnsubscribeToken(token);

      expect(result).toBe(TEST_USER_ID);
    });

    it("rejects a tampered token", async () => {
      vi.stubEnv("EMAIL_HMAC_SECRET", "test-secret-that-is-at-least-32-chars!");

      const { verifyUnsubscribeToken } = await import("@/lib/email");
      const timestamp = Math.floor(Date.now() / 1000);
      const result = verifyUnsubscribeToken(
        `${TEST_USER_ID}.${timestamp}.0000000000000000000000000000000000000000000000000000000000000000`
      );

      expect(result).toBeNull();
    });

    it("rejects a token without a dot separator", async () => {
      vi.stubEnv("EMAIL_HMAC_SECRET", "test-secret-that-is-at-least-32-chars!");

      const { verifyUnsubscribeToken } = await import("@/lib/email");
      expect(verifyUnsubscribeToken("notokenhere")).toBeNull();
    });

    it("rejects an empty string", async () => {
      vi.stubEnv("EMAIL_HMAC_SECRET", "test-secret-that-is-at-least-32-chars!");

      const { verifyUnsubscribeToken } = await import("@/lib/email");
      expect(verifyUnsubscribeToken("")).toBeNull();
    });

    it("rejects a token with empty userId", async () => {
      vi.stubEnv("EMAIL_HMAC_SECRET", "test-secret-that-is-at-least-32-chars!");

      const { verifyUnsubscribeToken } = await import("@/lib/email");
      expect(verifyUnsubscribeToken(".somehash")).toBeNull();
    });

    it("rejects a token with empty hmac", async () => {
      vi.stubEnv("EMAIL_HMAC_SECRET", "test-secret-that-is-at-least-32-chars!");

      const { verifyUnsubscribeToken } = await import("@/lib/email");
      expect(verifyUnsubscribeToken("user-abc.12345.")).toBeNull();
    });

    it("rejects token with non-hex HMAC", async () => {
      vi.stubEnv("EMAIL_HMAC_SECRET", "test-secret-that-is-at-least-32-chars!");

      const { verifyUnsubscribeToken } = await import("@/lib/email");
      const result = verifyUnsubscribeToken(
        "some-user-id.1234567890.zzzzzzzzzz"
      );
      expect(result).toBeNull();
    });

    it("rejects a token with non-UUID userId", async () => {
      vi.stubEnv("EMAIL_HMAC_SECRET", "test-secret-that-is-at-least-32-chars!");

      const { verifyUnsubscribeToken } = await import("@/lib/email");
      const result = verifyUnsubscribeToken(
        "not-a-uuid.12345.abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
      );

      expect(result).toBeNull();
    });

    it("rejects an expired token", async () => {
      vi.stubEnv("EMAIL_HMAC_SECRET", "test-secret-that-is-at-least-32-chars!");
      vi.useFakeTimers({ now: new Date("2025-01-01T00:00:00Z") });

      try {
        const { createUnsubscribeToken, verifyUnsubscribeToken } = await import(
          "@/lib/email"
        );
        const token = createUnsubscribeToken(TEST_USER_ID);

        // Advance 31 days past the 30-day expiry
        vi.advanceTimersByTime(31 * 24 * 60 * 60 * 1000);

        expect(verifyUnsubscribeToken(token)).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("escapeHtml", () => {
    it("escapes ampersands", async () => {
      const { escapeHtml } = await import("@/lib/email");
      expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
    });

    it("escapes all 5 HTML-sensitive characters together", async () => {
      const { escapeHtml } = await import("@/lib/email");
      expect(escapeHtml(`<div class="a" data='b'>&</div>`)).toBe(
        "&lt;div class=&quot;a&quot; data=&#x27;b&#x27;&gt;&amp;&lt;/div&gt;"
      );
    });

    it("returns empty string unchanged", async () => {
      const { escapeHtml } = await import("@/lib/email");
      expect(escapeHtml("")).toBe("");
    });
  });

  describe("getAppUrl", () => {
    it("throws for non-HTTPS URL in production", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_test_key");
      vi.stubEnv("EMAIL_HMAC_SECRET", "test-secret-that-is-at-least-32-chars!");
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://example.com");
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("VERCEL_ENV", "production");

      mockSend.mockResolvedValue({
        data: { id: "email-https" },
        error: null,
      });

      const { sendEmail } = await import("@/lib/email");
      await expect(
        sendEmail({
          to: "test@example.com",
          subject: "Test",
          html: "<p>Hi</p>",
          userId: TEST_USER_ID,
        })
      ).rejects.toThrow("NEXT_PUBLIC_APP_URL must use HTTPS");
    });
  });

  describe("sendWelcomeEmail", () => {
    it("includes personalized greeting when name is provided", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_test_key");
      vi.stubEnv("EMAIL_HMAC_SECRET", "test-secret-that-is-at-least-32-chars!");
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://themagiclab.app");
      vi.stubEnv("VERCEL_ENV", "production");

      mockSend.mockResolvedValue({
        data: { id: "welcome-123" },
        error: null,
      });

      const { sendWelcomeEmail } = await import("@/lib/email");
      await sendWelcomeEmail({
        to: "magician@example.com",
        userId: TEST_USER_ID,
        name: "Houdini",
      });

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.html).toContain("Hi Houdini");
    });

    it("uses generic greeting when name is omitted", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_test_key");
      vi.stubEnv("EMAIL_HMAC_SECRET", "test-secret-that-is-at-least-32-chars!");
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://themagiclab.app");
      vi.stubEnv("VERCEL_ENV", "production");

      mockSend.mockResolvedValue({
        data: { id: "welcome-456" },
        error: null,
      });

      const { sendWelcomeEmail } = await import("@/lib/email");
      await sendWelcomeEmail({
        to: "magician@example.com",
        userId: TEST_USER_ID,
      });

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.html).toContain("Hi, welcome to The Magic Lab!");
      expect(callArgs.html).not.toMatch(PERSONALIZED_GREETING_PATTERN);
    });

    it("calls sendEmail with correct subject", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_test_key");
      vi.stubEnv("EMAIL_HMAC_SECRET", "test-secret-that-is-at-least-32-chars!");
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://themagiclab.app");
      vi.stubEnv("VERCEL_ENV", "production");

      mockSend.mockResolvedValue({
        data: { id: "welcome-789" },
        error: null,
      });

      const { sendWelcomeEmail } = await import("@/lib/email");
      await sendWelcomeEmail({
        to: "magician@example.com",
        userId: TEST_USER_ID,
        name: "Houdini",
      });

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.subject).toBe("Welcome to The Magic Lab");
    });
  });

  describe("sendEmail", () => {
    it("calls Resend API with correct parameters", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_test_key");
      vi.stubEnv("EMAIL_HMAC_SECRET", "test-secret-that-is-at-least-32-chars!");
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://themagiclab.app");
      vi.stubEnv("VERCEL_ENV", "production");

      mockSend.mockResolvedValue({
        data: { id: "email-123" },
        error: null,
      });

      const { sendEmail } = await import("@/lib/email");
      const result = await sendEmail({
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Hello</p>",
      });

      expect(result).toEqual({ id: "email-123" });
      expect(mockSend).toHaveBeenCalledWith({
        from: "The Magic Lab <noreply@themagiclab.app>",
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Hello</p>",
        headers: {},
      });
    });

    it("includes unsubscribe headers when userId is provided", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_test_key");
      vi.stubEnv("EMAIL_HMAC_SECRET", "test-secret-that-is-at-least-32-chars!");
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://themagiclab.app");
      vi.stubEnv("VERCEL_ENV", "production");

      mockSend.mockResolvedValue({
        data: { id: "email-456" },
        error: null,
      });

      const { sendEmail } = await import("@/lib/email");
      await sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Hi</p>",
        userId: TEST_USER_ID,
      });

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.headers["List-Unsubscribe"]).toMatch(
        UNSUBSCRIBE_URL_PATTERN
      );
      expect(callArgs.headers["List-Unsubscribe-Post"]).toBe(
        "List-Unsubscribe=One-Click"
      );
    });

    it("throws when Resend returns an error", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_test_key");

      mockSend.mockResolvedValue({
        data: null,
        error: { message: "Invalid API key" },
      });

      const { sendEmail } = await import("@/lib/email");
      await expect(
        sendEmail({
          to: "test@example.com",
          subject: "Test",
          html: "<p>Hi</p>",
        })
      ).rejects.toThrow("Failed to send email: Invalid API key");
    });

    it("throws when Resend returns no data", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_test_key");

      mockSend.mockResolvedValue({ data: null, error: null });

      const { sendEmail } = await import("@/lib/email");
      await expect(
        sendEmail({
          to: "test@example.com",
          subject: "Test",
          html: "<p>Hi</p>",
        })
      ).rejects.toThrow("Failed to send email: no response data");
    });

    it("redirects to delivered@resend.dev in non-production environments", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_test_key");
      vi.stubEnv("EMAIL_HMAC_SECRET", "test-secret-that-is-at-least-32-chars!");
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://themagiclab.app");
      vi.stubEnv("VERCEL_ENV", "preview");

      mockSend.mockResolvedValue({
        data: { id: "email-preview" },
        error: null,
      });

      const { sendEmail } = await import("@/lib/email");
      await sendEmail({
        to: "real-user@example.com",
        subject: "Test",
        html: "<p>Hi</p>",
      });

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.to).toBe("delivered@resend.dev");
    });

    it("throws when RESEND_API_KEY is missing", async () => {
      vi.stubEnv("RESEND_API_KEY", "");

      const { sendEmail } = await import("@/lib/email");
      await expect(
        sendEmail({
          to: "test@example.com",
          subject: "Test",
          html: "<p>Hi</p>",
        })
      ).rejects.toThrow("RESEND_API_KEY environment variable is required");
    });
  });
});
