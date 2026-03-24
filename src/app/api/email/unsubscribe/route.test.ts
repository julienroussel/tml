import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const mockOnConflictDoUpdate = vi.fn();
const mockInsertValues = vi.fn(() => ({
  onConflictDoUpdate: mockOnConflictDoUpdate,
}));
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

vi.mock("@/db", () => ({
  getDb: () => ({ insert: mockInsert }),
}));

vi.mock("@/db/schema", () => ({
  userPreferences: { userId: "userPreferences.userId" },
}));

const mockVerifyUnsubscribeToken = vi.fn();

vi.mock("@/lib/email", () => ({
  escapeHtml: (v: string) =>
    v
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#x27;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;"),
  verifyUnsubscribeToken: (token: string) => mockVerifyUnsubscribeToken(token),
}));

function createGetRequest(token?: string): NextRequest {
  const url = token
    ? `https://themagiclab.app/api/email/unsubscribe?token=${encodeURIComponent(token)}`
    : "https://themagiclab.app/api/email/unsubscribe";
  return new NextRequest(url, { method: "GET" });
}

function createPostRequest(
  token: string | null,
  options: { origin?: string | null; referer?: string | null } = {}
): NextRequest {
  const body = new FormData();
  if (token !== null) {
    body.set("token", token);
  }

  const headers = new Headers();
  if (options.origin !== null && options.origin !== undefined) {
    headers.set("origin", options.origin);
  }
  if (options.referer !== null && options.referer !== undefined) {
    headers.set("referer", options.referer);
  }

  return new NextRequest("https://themagiclab.app/api/email/unsubscribe", {
    method: "POST",
    body,
    headers,
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/email/unsubscribe", () => {
  it("renders the confirmation form when token is present", async () => {
    const response = GET(createGetRequest("valid-token"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Security-Policy")).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'"
    );
    const html = await response.text();
    expect(html).toContain(
      '<form method="POST" action="/api/email/unsubscribe">'
    );
    expect(html).toContain('value="valid-token"');
  });

  it("returns 400 with CSP header when token is missing", () => {
    const response = GET(createGetRequest());

    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Security-Policy")).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'"
    );
  });

  it("escapes the token in the HTML output", async () => {
    const response = GET(createGetRequest('<script>alert("xss")</script>'));
    const html = await response.text();

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("includes brand header with THE and MAGIC LAB", async () => {
    const response = GET(createGetRequest("test-token"));
    const html = await response.text();

    expect(html).toContain(">THE</p>");
    expect(html).toContain(">MAGIC LAB</p>");
  });

  it("sets Content-Type to text/html", () => {
    const response = GET(createGetRequest("test-token"));

    expect(response.headers.get("Content-Type")).toBe("text/html");
  });
});

describe("POST /api/email/unsubscribe", () => {
  it("returns 403 when neither Origin nor Referer header is present", async () => {
    const request = createPostRequest("some-token", { origin: null });
    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(mockVerifyUnsubscribeToken).not.toHaveBeenCalled();
    const html = await response.text();
    expect(html).toContain("Invalid request origin");
  });

  it("rejects request when Origin header is absent (even with valid Referer)", async () => {
    const request = createPostRequest("some-token", {
      origin: null,
      referer: "https://themagiclab.app/api/email/unsubscribe",
    });
    const response = await POST(request);

    // Origin is strictly required — Referer fallback was removed for CSRF hardening
    expect(response.status).toBe(403);
    expect(mockVerifyUnsubscribeToken).not.toHaveBeenCalled();
  });

  it("returns 403 when Referer is an invalid URL", async () => {
    const request = createPostRequest("some-token", {
      origin: null,
      referer: "not-a-valid-url",
    });
    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  it("returns 403 when Origin header does not match", async () => {
    const request = createPostRequest("some-token", {
      origin: "https://evil.example.com",
    });
    const response = await POST(request);

    expect(response.status).toBe(403);
    const html = await response.text();
    expect(html).toContain("Invalid request origin");
  });

  it("returns 400 when token is missing from form data", async () => {
    const request = createPostRequest(null, {
      origin: "https://themagiclab.app",
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 400 when HMAC token verification fails", async () => {
    mockVerifyUnsubscribeToken.mockReturnValue(null);

    const request = createPostRequest("invalid-token", {
      origin: "https://themagiclab.app",
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(mockVerifyUnsubscribeToken).toHaveBeenCalledWith("invalid-token");
  });

  it("returns 404 when FK constraint fails (user does not exist)", async () => {
    mockVerifyUnsubscribeToken.mockReturnValue("user-123");
    const fkError = new Error("foreign key constraint violation");
    (fkError as unknown as { code: string }).code = "23503";
    mockOnConflictDoUpdate.mockRejectedValue(fkError);

    const request = createPostRequest("valid-token", {
      origin: "https://themagiclab.app",
    });
    const response = await POST(request);

    expect(response.status).toBe(404);
    expect(mockVerifyUnsubscribeToken).toHaveBeenCalledWith("valid-token");
  });

  it("successfully unsubscribes a user via upsert", async () => {
    mockVerifyUnsubscribeToken.mockReturnValue("user-123");
    mockOnConflictDoUpdate.mockResolvedValue(undefined);

    const request = createPostRequest("valid-token", {
      origin: "https://themagiclab.app",
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Security-Policy")).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'"
    );
    const html = await response.text();
    expect(html).toContain("Unsubscribed");
    expect(mockInsert).toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-123", emailEnabled: false })
    );
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        target: "userPreferences.userId",
        set: expect.objectContaining({ emailEnabled: false }),
      })
    );
  });

  it("normalizes origin with trailing slashes", async () => {
    mockVerifyUnsubscribeToken.mockReturnValue("user-123");
    mockOnConflictDoUpdate.mockResolvedValue(undefined);

    const request = createPostRequest("valid-token", {
      origin: "https://themagiclab.app///",
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
  });

  it("includes brand header in success response", async () => {
    mockVerifyUnsubscribeToken.mockReturnValue("user-123");
    mockOnConflictDoUpdate.mockResolvedValue(undefined);

    const request = createPostRequest("valid-token", {
      origin: "https://themagiclab.app",
    });
    const response = await POST(request);
    const html = await response.text();

    expect(html).toContain(">THE</p>");
    expect(html).toContain(">MAGIC LAB</p>");
  });

  it("sets Content-Type to text/html on all responses", async () => {
    const request = createPostRequest(null, {
      origin: "https://themagiclab.app",
    });
    const response = await POST(request);

    expect(response.headers.get("Content-Type")).toBe("text/html");
  });

  it("returns 500 when database throws a non-FK error", async () => {
    mockVerifyUnsubscribeToken.mockReturnValue("user-123");
    mockOnConflictDoUpdate.mockRejectedValue(new Error("DB connection failed"));

    const request = createPostRequest("valid-token", {
      origin: "https://themagiclab.app",
    });
    const response = await POST(request);

    expect(response.status).toBe(500);
    const html = await response.text();
    expect(html).toContain("Failed to unsubscribe");
  });
});
