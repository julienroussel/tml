import { describe, expect, it, vi } from "vitest";

const mockCreateAuthClient = vi.fn(() => ({ signIn: vi.fn() }));

vi.mock("@neondatabase/auth/next", () => ({
  createAuthClient: mockCreateAuthClient,
}));

describe("auth/client", () => {
  it("exports authClient created by createAuthClient", async () => {
    const { authClient } = await import("./client");
    expect(authClient).toBeDefined();
    expect(mockCreateAuthClient).toHaveBeenCalledOnce();
  });
});
