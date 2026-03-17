import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

interface MockSession {
  data: {
    user: { id: string } | null;
  };
}

const authenticatedSession: MockSession = {
  data: { user: { id: "user-1" } },
};

const nullUserSession: MockSession = {
  data: { user: null },
};

const mockMiddleware = vi.fn();

vi.mock("@/auth/server", () => ({
  auth: {
    getSession: vi.fn(),
    middleware: vi.fn(() => mockMiddleware),
  },
}));

const SESSION_COOKIE_NAME = "__Secure-neon-auth.session_token";

function createRequest(pathname: string, withCookie = false): NextRequest {
  const url = new URL(pathname, "https://themagiclab.app");
  const request = new NextRequest(url);
  if (withCookie) {
    request.cookies.set(SESSION_COOKIE_NAME, "fake-session-token");
  }
  return request;
}

describe("proxy", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects authenticated users away from /auth/sign-in to /dashboard", async () => {
    const { auth } = await import("@/auth/server");
    vi.mocked(auth.getSession).mockResolvedValueOnce(authenticatedSession);

    const { proxy } = await import("./proxy");
    const response = await proxy(createRequest("/auth/sign-in", true));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
      "/dashboard"
    );
  });

  it("redirects authenticated users away from /auth/sign-up to /dashboard", async () => {
    const { auth } = await import("@/auth/server");
    vi.mocked(auth.getSession).mockResolvedValueOnce(authenticatedSession);

    const { proxy } = await import("./proxy");
    const response = await proxy(createRequest("/auth/sign-up", true));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
      "/dashboard"
    );
  });

  it("does not redirect when session cookie is missing", async () => {
    const { proxy } = await import("./proxy");
    mockMiddleware.mockReturnValueOnce(new Response(null, { status: 200 }));

    await proxy(createRequest("/auth/sign-in", false));

    const { auth } = await import("@/auth/server");
    expect(auth.getSession).not.toHaveBeenCalled();
    expect(mockMiddleware).toHaveBeenCalled();
  });

  it("does not redirect when session cookie is present but user is invalid", async () => {
    const { auth } = await import("@/auth/server");
    vi.mocked(auth.getSession).mockResolvedValueOnce(nullUserSession);

    mockMiddleware.mockReturnValueOnce(new Response(null, { status: 200 }));

    const { proxy } = await import("./proxy");
    const response = await proxy(createRequest("/auth/sign-in", true));

    expect(auth.getSession).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("falls through to auth middleware when getSession throws", async () => {
    const { auth } = await import("@/auth/server");
    vi.mocked(auth.getSession).mockRejectedValueOnce(
      new Error("network error")
    );

    mockMiddleware.mockReturnValueOnce(new Response(null, { status: 200 }));

    const { proxy } = await import("./proxy");
    const response = await proxy(createRequest("/auth/sign-in", true));

    expect(response.status).toBe(200);
    expect(mockMiddleware).toHaveBeenCalled();
  });

  it("passes through to auth middleware for protected routes", async () => {
    const { proxy } = await import("./proxy");
    mockMiddleware.mockReturnValueOnce(new Response(null, { status: 200 }));

    await proxy(createRequest("/dashboard", false));

    expect(mockMiddleware).toHaveBeenCalled();
  });

  describe("public routes (outside matcher)", () => {
    it("does not match the root marketing page", async () => {
      const { config } = await import("./proxy");
      for (const pattern of config.matcher) {
        expect("/").not.toMatch(
          new RegExp(`^${pattern.replace(":path*", ".*")}$`)
        );
      }
    });

    it("does not match marketing routes like /faq or /privacy", async () => {
      const { config } = await import("./proxy");
      const marketingRoutes = ["/faq", "/privacy", "/terms", "/about"];
      for (const route of marketingRoutes) {
        const matched = config.matcher.some((pattern) =>
          new RegExp(`^${pattern.replace(":path*", ".*")}$`).test(route)
        );
        expect(matched, `${route} should not be matched by proxy`).toBe(false);
      }
    });

    it("does not match API routes", async () => {
      const { config } = await import("./proxy");
      const apiRoutes = ["/api/health", "/api/powersync/upload"];
      for (const route of apiRoutes) {
        const matched = config.matcher.some((pattern) =>
          new RegExp(`^${pattern.replace(":path*", ".*")}$`).test(route)
        );
        expect(matched, `${route} should not be matched by proxy`).toBe(false);
      }
    });
  });

  describe("config", () => {
    it("includes all protected route patterns", async () => {
      const { config } = await import("./proxy");

      expect(config.matcher).toContain("/auth/:path*");
      expect(config.matcher).toContain("/dashboard/:path*");
      expect(config.matcher).toContain("/improve/:path*");
      expect(config.matcher).toContain("/train/:path*");
      expect(config.matcher).toContain("/plan/:path*");
      expect(config.matcher).toContain("/perform/:path*");
      expect(config.matcher).toContain("/enhance/:path*");
      expect(config.matcher).toContain("/collect/:path*");
      expect(config.matcher).toContain("/settings/:path*");
      expect(config.matcher).toContain("/admin/:path*");
      expect(config.matcher).toContain("/account/:path*");
    });
  });
});
