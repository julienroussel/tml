import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockGetSession = vi.fn();
const mockIsUserBanned = vi.fn();

const mockHandlerGET = vi.fn();
const mockHandlerPOST = vi.fn();

vi.mock("@/auth/ban-check", () => ({
  isUserBanned: (...args: unknown[]) => mockIsUserBanned(...args),
}));

vi.mock("@/auth/server", () => ({
  auth: {
    getSession: mockGetSession,
    handler: () => ({
      GET: mockHandlerGET,
      POST: mockHandlerPOST,
    }),
  },
}));

const HANDLER_RESPONSE = new Response(JSON.stringify({ ok: true }), {
  status: 200,
});

beforeEach(() => {
  mockHandlerGET.mockResolvedValue(HANDLER_RESPONSE);
  mockHandlerPOST.mockResolvedValue(HANDLER_RESPONSE);
  mockIsUserBanned.mockResolvedValue(false);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

function createGetRequest(path: string): NextRequest {
  return new NextRequest(`https://themagiclab.app/api/auth/${path}`, {
    method: "GET",
  });
}

function createContext(pathSegments: string[]): {
  params: Promise<{ path: string[] }>;
} {
  return { params: Promise.resolve({ path: pathSegments }) };
}

describe("GET /api/auth/[...path]", () => {
  it("returns 403 when requesting /token and user is banned", async () => {
    mockGetSession.mockResolvedValue({
      data: { user: { id: "user-banned-123" } },
    });
    mockIsUserBanned.mockResolvedValue(true);
    const { GET } = await import("./route");

    const response = await GET(
      createGetRequest("token"),
      createContext(["token"])
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({ error: "Forbidden" });
    expect(mockHandlerGET).not.toHaveBeenCalled();
  });

  it("delegates to handler when requesting /token and user is not banned", async () => {
    mockGetSession.mockResolvedValue({
      data: { user: { id: "user-good-456" } },
    });
    mockIsUserBanned.mockResolvedValue(false);
    const { GET } = await import("./route");

    const request = createGetRequest("token");
    const context = createContext(["token"]);
    const response = await GET(request, context);

    expect(response).toBe(HANDLER_RESPONSE);
    expect(mockIsUserBanned).toHaveBeenCalledWith("user-good-456");
    expect(mockHandlerGET).toHaveBeenCalledWith(request, context);
  });

  it("delegates to handler without ban check for non-token paths", async () => {
    const { GET } = await import("./route");

    const request = createGetRequest("session");
    const context = createContext(["session"]);
    const response = await GET(request, context);

    expect(response).toBe(HANDLER_RESPONSE);
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockIsUserBanned).not.toHaveBeenCalled();
    expect(mockHandlerGET).toHaveBeenCalledWith(request, context);
  });

  it("delegates to handler when requesting /token with no session", async () => {
    mockGetSession.mockResolvedValue({ data: null });
    const { GET } = await import("./route");

    const request = createGetRequest("token");
    const context = createContext(["token"]);
    const response = await GET(request, context);

    expect(response).toBe(HANDLER_RESPONSE);
    expect(mockIsUserBanned).not.toHaveBeenCalled();
    expect(mockHandlerGET).toHaveBeenCalledWith(request, context);
  });

  it("delegates to handler when session user has no id", async () => {
    mockGetSession.mockResolvedValue({ data: { user: {} } });
    const { GET } = await import("./route");

    const request = createGetRequest("token");
    const context = createContext(["token"]);
    const response = await GET(request, context);

    expect(response).toBe(HANDLER_RESPONSE);
    expect(mockIsUserBanned).not.toHaveBeenCalled();
    expect(mockHandlerGET).toHaveBeenCalledWith(request, context);
  });
});

describe("POST /api/auth/[...path]", () => {
  it("is exported directly from the handler without ban interception", async () => {
    const { POST } = await import("./route");

    // POST is the handler's POST function directly — no wrapper
    expect(POST).toBe(mockHandlerPOST);
  });
});
