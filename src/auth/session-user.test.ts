import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth/client", () => ({
  authClient: {
    getSession: vi.fn(() =>
      Promise.resolve({ data: { user: { id: "user-123" } } })
    ),
  },
}));

const MESSAGE = "Cannot mutate tricks without an authenticated user";

type SessionData = ReturnType<
  typeof import("@/auth/client").authClient.useSession
>["data"];

/** A full session shape, so the helper's param type stays a real rename guard. */
function sessionWith(id: string): SessionData {
  return {
    user: {
      id,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      email: "magician@example.test",
      emailVerified: true,
      name: "Test Magician",
      banned: null,
    },
    session: {
      id: "session-1",
      createdAt: new Date(0),
      updatedAt: new Date(0),
      userId: id,
      expiresAt: new Date(0),
      token: "token",
    },
  } as NonNullable<SessionData>;
}

async function getSubject() {
  const [{ resolveUserId }, { authClient }] = await Promise.all([
    import("./session-user"),
    import("@/auth/client"),
  ]);
  return { resolveUserId, authClient };
}

describe("resolveUserId", () => {
  beforeEach(async () => {
    const { authClient } = await getSubject();
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: { user: { id: "user-123" } },
    } as Awaited<ReturnType<typeof authClient.getSession>>);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("returns the reactive session id without a round trip", async () => {
    const { resolveUserId, authClient } = await getSubject();

    await expect(
      resolveUserId(sessionWith("user-123"), false, MESSAGE)
    ).resolves.toBe("user-123");
    expect(authClient.getSession).not.toHaveBeenCalled();
  });

  it("prefers the reactive session even while pending", async () => {
    const { resolveUserId, authClient } = await getSubject();

    await expect(
      resolveUserId(sessionWith("user-123"), true, MESSAGE)
    ).resolves.toBe("user-123");
    expect(authClient.getSession).not.toHaveBeenCalled();
  });

  it("resolves the pending session rather than dropping the write", async () => {
    const { resolveUserId, authClient } = await getSubject();
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: { user: { id: "user-456" } },
    } as Awaited<ReturnType<typeof authClient.getSession>>);

    await expect(resolveUserId(null, true, MESSAGE)).resolves.toBe("user-456");
    expect(authClient.getSession).toHaveBeenCalledTimes(1);
  });

  it("fails fast on a settled-null session, with no round trip", async () => {
    const { resolveUserId, authClient } = await getSubject();

    await expect(resolveUserId(null, false, MESSAGE)).rejects.toThrow(MESSAGE);
    expect(authClient.getSession).not.toHaveBeenCalled();
  });

  it("surfaces the domain error when the pending fetch rejects", async () => {
    const { resolveUserId, authClient } = await getSubject();
    const cause = new TypeError("Failed to fetch");
    vi.mocked(authClient.getSession).mockRejectedValue(cause);

    // Offline, getSession rejects; the raw TypeError must not escape to the
    // caller's toast mapping in place of the domain error.
    await expect(resolveUserId(null, true, MESSAGE)).rejects.toThrow(MESSAGE);
    await expect(resolveUserId(null, true, MESSAGE)).rejects.toMatchObject({
      cause,
    });
  });

  it("throws when the pending fetch resolves without a user", async () => {
    const { resolveUserId, authClient } = await getSubject();
    const error = { status: 401, statusText: "Unauthorized" };
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: null,
      error,
    } as unknown as Awaited<ReturnType<typeof authClient.getSession>>);

    await expect(resolveUserId(null, true, MESSAGE)).rejects.toThrow(MESSAGE);
    await expect(resolveUserId(null, true, MESSAGE)).rejects.toMatchObject({
      cause: error,
    });
  });

  it("gives up waiting when the pending fetch never settles", async () => {
    vi.useFakeTimers();
    const { resolveUserId, authClient } = await getSubject();
    // The Neon adapter dedupes /get-session, so a hung in-flight request is
    // handed back to us unbounded — the wait is ours to cap, not the fetch's.
    vi.mocked(authClient.getSession).mockReturnValue(
      new Promise(() => {
        // never settles
      }) as ReturnType<typeof authClient.getSession>
    );

    const pending = resolveUserId(null, true, MESSAGE);
    const assertion = expect(pending).rejects.toThrow(MESSAGE);
    await vi.advanceTimersByTimeAsync(3000);
    await assertion;
  });
});
