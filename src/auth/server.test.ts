import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockCreateNeonAuth = vi.fn(() => ({
  getSession: vi.fn(),
}));

vi.mock("@neondatabase/auth/next/server", () => ({
  createNeonAuth: mockCreateNeonAuth,
}));

describe("auth/server", () => {
  it("throws when NEON_AUTH_BASE_URL is missing", async () => {
    vi.stubEnv("NEON_AUTH_BASE_URL", "");
    vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "secret");
    vi.resetModules();

    await expect(import("./server")).rejects.toThrow(
      "NEON_AUTH_BASE_URL environment variable is required"
    );
  });

  it("throws when NEON_AUTH_COOKIE_SECRET is missing", async () => {
    vi.stubEnv("NEON_AUTH_BASE_URL", "https://auth.example.com");
    vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "");
    vi.resetModules();

    await expect(import("./server")).rejects.toThrow(
      "NEON_AUTH_COOKIE_SECRET environment variable is required"
    );
  });

  it("exports auth when env vars are set", async () => {
    vi.stubEnv("NEON_AUTH_BASE_URL", "https://auth.example.com");
    vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "test-secret");
    vi.resetModules();

    const { auth } = await import("./server");
    expect(auth).toBeDefined();
    expect(mockCreateNeonAuth).toHaveBeenCalledWith({
      baseUrl: "https://auth.example.com",
      cookies: { secret: "test-secret" },
    });
  });
});
