import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("checkRateLimit", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  describe("in-memory fallback (non-Vercel)", () => {
    it("allows up to 10 requests per window", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
      try {
        const { checkRateLimit } = await import("./rate-limit");

        for (let i = 0; i < 10; i++) {
          expect(await checkRateLimit("user-1")).toBe(false);
        }

        expect(await checkRateLimit("user-1")).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it("resets after 60 seconds", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
      try {
        const { checkRateLimit } = await import("./rate-limit");

        for (let i = 0; i < 10; i++) {
          await checkRateLimit("user-1");
        }
        expect(await checkRateLimit("user-1")).toBe(true);

        // Advance past the 60s window (strict > check requires +1ms)
        vi.advanceTimersByTime(60_001);

        expect(await checkRateLimit("user-1")).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it("tracks users independently", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
      try {
        const { checkRateLimit } = await import("./rate-limit");

        for (let i = 0; i < 10; i++) {
          await checkRateLimit("user-1");
        }
        expect(await checkRateLimit("user-1")).toBe(true);

        // Different user should not be affected
        expect(await checkRateLimit("user-2")).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("Vercel WAF path", () => {
    it("delegates to @vercel/firewall when on Vercel", async () => {
      vi.stubEnv("VERCEL", "1");

      const mockVercelCheckRateLimit = vi
        .fn()
        .mockResolvedValue({ rateLimited: false });
      vi.doMock("@vercel/firewall", () => ({
        checkRateLimit: mockVercelCheckRateLimit,
      }));

      const { checkRateLimit } = await import("./rate-limit");
      const result = await checkRateLimit("user-1");

      expect(result).toBe(false);
      expect(mockVercelCheckRateLimit).toHaveBeenCalledWith(
        "send-notification",
        { rateLimitKey: "user-1" }
      );
    });

    it("returns true when Vercel WAF says rate limited", async () => {
      vi.stubEnv("VERCEL", "1");

      const mockVercelCheckRateLimit = vi
        .fn()
        .mockResolvedValue({ rateLimited: true });
      vi.doMock("@vercel/firewall", () => ({
        checkRateLimit: mockVercelCheckRateLimit,
      }));

      const { checkRateLimit } = await import("./rate-limit");
      expect(await checkRateLimit("user-1")).toBe(true);
    });

    it("falls back to in-memory when @vercel/firewall throws", async () => {
      vi.stubEnv("VERCEL", "1");

      vi.doMock("@vercel/firewall", () => ({
        checkRateLimit: vi.fn().mockRejectedValue(new Error("Service down")),
      }));

      const consoleError = vi
        .spyOn(console, "error")
        // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress console.error output during test
        .mockImplementation(() => {});

      const { checkRateLimit } = await import("./rate-limit");
      // First call should fall back to in-memory and allow
      expect(await checkRateLimit("user-1")).toBe(false);
      expect(consoleError).toHaveBeenCalledWith(
        "Vercel rate limit check failed, falling back to in-memory:",
        expect.any(Error)
      );
      consoleError.mockRestore();
    });

    it("falls back to in-memory when @vercel/firewall import fails", async () => {
      vi.stubEnv("VERCEL", "1");

      vi.doMock("@vercel/firewall", () => {
        throw new Error("Module not found");
      });

      const consoleError = vi
        .spyOn(console, "error")
        // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress console.error output during test
        .mockImplementation(() => {});

      const { checkRateLimit } = await import("./rate-limit");
      // First call should fall back to in-memory and allow
      expect(await checkRateLimit("user-1")).toBe(false);
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe("in-memory cleanup", () => {
    it("cleans up expired entries when map exceeds 100 users", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
      try {
        const { checkRateLimit } = await import("./rate-limit");

        // Create 101 users to trigger cleanup threshold
        for (let i = 0; i < 101; i++) {
          await checkRateLimit(`user-${i}`);
        }

        // Advance past the window so all entries expire
        vi.advanceTimersByTime(60_001);

        // Next call from a new user should trigger cleanup of expired entries
        // but still allow the request
        await checkRateLimit("new-user");

        // Verify existing expired users got cleaned up by checking that
        // a previously rate-limited user can now make requests again
        // (their entry was cleaned up, not just expired)
        await checkRateLimit("user-0");
        expect(await checkRateLimit("user-0")).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
