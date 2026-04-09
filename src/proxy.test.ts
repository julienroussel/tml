import { NextRequest, NextResponse } from "next/server";
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

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
  cookies: () =>
    Promise.resolve({
      get: () => undefined,
      getAll: () => [],
      has: () => false,
    }),
}));

vi.mock("@/auth/server", () => ({
  auth: {
    getSession: vi.fn(),
    middleware: vi.fn(() => mockMiddleware),
  },
}));

vi.mock("@/lib/csp", () => ({
  buildCsp: vi.fn(
    () => "default-src 'self'; script-src 'self' 'unsafe-inline'"
  ),
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

/** Creates a mock auth middleware response with cookies support */
function createAuthResponse(
  status: number,
  headers?: Record<string, string>
): NextResponse {
  return NextResponse.next({
    status,
    headers: new Headers(headers),
  });
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
    mockMiddleware.mockReturnValueOnce(createAuthResponse(200));

    await proxy(createRequest("/auth/sign-in", false));

    const { auth } = await import("@/auth/server");
    expect(auth.getSession).not.toHaveBeenCalled();
    expect(mockMiddleware).toHaveBeenCalled();
  });

  it("does not redirect when session cookie is present but user is invalid", async () => {
    const { auth } = await import("@/auth/server");
    vi.mocked(auth.getSession).mockResolvedValueOnce(nullUserSession);

    mockMiddleware.mockReturnValueOnce(createAuthResponse(200));

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

    mockMiddleware.mockReturnValueOnce(createAuthResponse(200));

    const { proxy } = await import("./proxy");
    const response = await proxy(createRequest("/auth/sign-in", true));

    expect(response.status).toBe(200);
    expect(mockMiddleware).toHaveBeenCalled();
  });

  it("passes through to auth middleware for protected routes", async () => {
    const { proxy } = await import("./proxy");
    mockMiddleware.mockReturnValueOnce(createAuthResponse(200));

    await proxy(createRequest("/dashboard", false));

    expect(mockMiddleware).toHaveBeenCalled();
  });

  it("sets Content-Security-Policy header on all responses", async () => {
    const { proxy } = await import("./proxy");

    // Public route (locale-prefixed — bare "/" redirects to /en)
    const publicResponse = await proxy(createRequest("/en", false));
    expect(publicResponse.headers.get("Content-Security-Policy")).toBeTruthy();

    // Protected route
    mockMiddleware.mockReturnValueOnce(createAuthResponse(200));
    const protectedResponse = await proxy(createRequest("/dashboard", false));
    expect(
      protectedResponse.headers.get("Content-Security-Policy")
    ).toBeTruthy();
  });

  it("does not call auth middleware for public routes", async () => {
    const { proxy } = await import("./proxy");

    // Use locale-prefixed path (bare "/" now redirects)
    await proxy(createRequest("/en", false));

    expect(mockMiddleware).not.toHaveBeenCalled();
  });

  it("redirects authenticated users from / to /dashboard", async () => {
    const { proxy } = await import("./proxy");

    const response = await proxy(createRequest("/", true));
    expect(response.status).toBe(302);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
      "/dashboard"
    );
    expect(response.headers.get("Content-Security-Policy")).toBeTruthy();
  });

  it("redirects bare marketing paths to locale-prefixed versions", async () => {
    const { proxy } = await import("./proxy");

    const rootResponse = await proxy(createRequest("/", false));
    expect(rootResponse.status).toBe(302);
    expect(new URL(rootResponse.headers.get("location") ?? "").pathname).toBe(
      "/en"
    );

    const faqResponse = await proxy(createRequest("/faq", false));
    expect(faqResponse.status).toBe(302);
    expect(new URL(faqResponse.headers.get("location") ?? "").pathname).toBe(
      "/en/faq"
    );

    const privacyResponse = await proxy(createRequest("/privacy", false));
    expect(privacyResponse.status).toBe(302);
    expect(
      new URL(privacyResponse.headers.get("location") ?? "").pathname
    ).toBe("/en/privacy");
  });

  it("detects locale from NEXT_LOCALE cookie for marketing redirect", async () => {
    const { proxy } = await import("./proxy");

    const request = createRequest("/", false);
    request.cookies.set("NEXT_LOCALE", "fr");
    const response = await proxy(request);

    expect(response.status).toBe(302);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
      "/fr"
    );
  });

  it("detects locale from Accept-Language header when no cookie is set", async () => {
    const { proxy } = await import("./proxy");

    const request = createRequest("/", false);
    request.headers.set("accept-language", "fr-FR,fr;q=0.9,en;q=0.8");
    const response = await proxy(request);

    expect(response.status).toBe(302);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
      "/fr"
    );
  });

  it("falls back to Accept-Language when NEXT_LOCALE cookie has invalid value", async () => {
    const { proxy } = await import("./proxy");
    const request = createRequest("/", false);
    request.cookies.set("NEXT_LOCALE", "xyz");
    request.headers.set("accept-language", "fr");
    const response = await proxy(request);
    expect(response.status).toBe(302);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
      "/fr"
    );
  });

  it("falls back to default locale when Accept-Language has no supported locales", async () => {
    const { proxy } = await import("./proxy");

    const request = createRequest("/", false);
    request.headers.set("accept-language", "ja,zh,ko");
    const response = await proxy(request);

    expect(response.status).toBe(302);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
      "/en"
    );
  });

  it("calls buildCsp with isDev option", async () => {
    const { buildCsp } = await import("@/lib/csp");
    const { proxy } = await import("./proxy");

    await proxy(createRequest("/about", false));

    expect(buildCsp).toHaveBeenCalledWith(
      expect.objectContaining({ isDev: expect.any(Boolean) })
    );
  });

  it("sets CSP header on auth redirect response", async () => {
    const { auth } = await import("@/auth/server");
    vi.mocked(auth.getSession).mockResolvedValueOnce(authenticatedSession);

    const { proxy } = await import("./proxy");
    const response = await proxy(createRequest("/auth/sign-in", true));

    expect(response.status).toBe(307);
    expect(response.headers.get("Content-Security-Policy")).toBeTruthy();
  });

  it("carries over cookies from auth middleware response", async () => {
    const { proxy } = await import("./proxy");

    const authResponse = createAuthResponse(200);
    authResponse.cookies.set("auth-token", "abc123", { path: "/" });
    authResponse.cookies.set("refresh-token", "xyz789", { path: "/" });
    mockMiddleware.mockReturnValueOnce(authResponse);

    const response = await proxy(createRequest("/dashboard", false));

    expect(response.cookies.get("auth-token")?.value).toBe("abc123");
    expect(response.cookies.get("refresh-token")?.value).toBe("xyz789");
  });

  it("does not include nonce in CSP (unsafe-inline covers all inline scripts)", async () => {
    const { proxy } = await import("./proxy");

    const response = await proxy(createRequest("/about", false));
    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).toBeTruthy();
    expect(csp).not.toContain("nonce");
  });

  it("applies CSP header to auth middleware redirect", async () => {
    const { proxy } = await import("./proxy");

    // Auth middleware returns a redirect (user not authenticated)
    const redirectResponse = NextResponse.redirect(
      new URL("/auth/sign-in", "https://themagiclab.app"),
      { status: 302 }
    );
    mockMiddleware.mockReturnValueOnce(redirectResponse);

    const response = await proxy(createRequest("/dashboard", false));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/auth/sign-in");
    expect(response.headers.get("Content-Security-Policy")).toBeTruthy();
  });

  it("redirects to sign-in with CSP when auth middleware throws", async () => {
    const { proxy } = await import("./proxy");
    mockMiddleware.mockRejectedValueOnce(new Error("auth SDK crash"));

    const response = await proxy(createRequest("/dashboard", false));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/auth/sign-in");
    expect(response.headers.get("Content-Security-Policy")).toBeTruthy();
  });

  it("forwards auth middleware error responses with CSP", async () => {
    const { proxy } = await import("./proxy");

    const errorResponse = new NextResponse(null, { status: 403 });
    mockMiddleware.mockReturnValueOnce(errorResponse);

    const response = await proxy(createRequest("/dashboard", false));

    expect(response.status).toBe(403);
    expect(response.headers.get("Content-Security-Policy")).toBeTruthy();
  });

  describe("needsAuth", () => {
    it("returns true for exact prefix match", async () => {
      const { proxy } = await import("./proxy");
      mockMiddleware.mockReturnValueOnce(createAuthResponse(200));

      await proxy(createRequest("/admin", false));

      expect(mockMiddleware).toHaveBeenCalled();
    });

    it("returns true for sub-path of protected prefix", async () => {
      const { proxy } = await import("./proxy");
      mockMiddleware.mockReturnValueOnce(createAuthResponse(200));

      await proxy(createRequest("/admin/users", false));

      expect(mockMiddleware).toHaveBeenCalled();
    });

    it("returns false for partial prefix match like /administrators", async () => {
      const { proxy } = await import("./proxy");

      await proxy(createRequest("/administrators", false));

      expect(mockMiddleware).not.toHaveBeenCalled();
    });

    it("returns false for paths not in protected list", async () => {
      const { proxy } = await import("./proxy");

      await proxy(createRequest("/about", false));

      expect(mockMiddleware).not.toHaveBeenCalled();
    });
  });

  describe("matcher", () => {
    it("uses a catch-all regex that excludes static assets", async () => {
      const { config } = await import("./proxy");

      expect(config.matcher).toHaveLength(1);
      const pattern = config.matcher[0];

      // Should be a negative lookahead regex
      expect(pattern).toContain("_next/static");
      expect(pattern).toContain("_next/image");
      expect(pattern).toContain("favicon\\.ico");
      expect(pattern).toContain("sw\\.js");
    });

    it("excludes static file extensions", async () => {
      const { config } = await import("./proxy");
      const pattern = config.matcher[0];

      expect(pattern).toContain("svg");
      expect(pattern).toContain("png");
      expect(pattern).toContain("jpg");
      expect(pattern).toContain("woff2");
    });
  });
});
