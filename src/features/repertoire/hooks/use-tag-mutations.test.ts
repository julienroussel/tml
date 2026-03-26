import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks -----------------------------------------------------------

const mockExecute = vi.fn();

vi.mock("@powersync/react", () => ({
  usePowerSync: vi.fn(() => ({
    execute: mockExecute,
  })),
}));

vi.mock("@/auth/client", () => ({
  authClient: {
    useSession: vi.fn(() => ({
      data: { user: { id: "user-123" } },
      isPending: false,
    })),
  },
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}));

let uuidCounter = 0;
vi.stubGlobal("crypto", {
  ...globalThis.crypto,
  randomUUID: () => `uuid-${++uuidCounter}`,
});

// --- Test suite -------------------------------------------------------

describe("use-tag-mutations", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00.000Z"));
    uuidCounter = 0;

    // Restore authenticated session (may have been nulled by a previous test)
    const { authClient } = await import("@/auth/client");
    vi.mocked(authClient.useSession).mockReturnValue({
      data: { user: { id: "user-123" } },
      isPending: false,
    } as ReturnType<typeof authClient.useSession>);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  function getHookExports() {
    return import("./use-tag-mutations");
  }

  describe("createTag", () => {
    it("trims and lowercases the tag name", async () => {
      const { useTagMutations } = await getHookExports();
      const { createTag } = useTagMutations();

      await createTag("  Opener  ");

      const params = mockExecute.mock.calls[0]?.[1] as unknown[];
      expect(params[2]).toBe("opener"); // normalized name
    });

    it("generates a UUID and returns it", async () => {
      const { useTagMutations } = await getHookExports();
      const { createTag } = useTagMutations();

      const id = await createTag("closer");
      expect(id).toBe("uuid-1");
    });

    it("executes correct INSERT SQL with all params", async () => {
      const { useTagMutations } = await getHookExports();
      const { createTag } = useTagMutations();

      await createTag("opener", "#ff5733");

      expect(mockExecute).toHaveBeenCalledOnce();
      const sql = mockExecute.mock.calls[0]?.[0] as string;
      expect(sql).toContain("INSERT INTO tags");

      const params = mockExecute.mock.calls[0]?.[1] as unknown[];
      expect(params[0]).toBe("uuid-1"); // id
      expect(params[1]).toBe("user-123"); // user_id
      expect(params[2]).toBe("opener"); // name
      expect(params[3]).toBe("#ff5733"); // color
      expect(params[4]).toBe("2025-01-15T12:00:00.000Z"); // created_at
      expect(params[5]).toBe("2025-01-15T12:00:00.000Z"); // updated_at
    });

    it("defaults color to null when not provided", async () => {
      const { useTagMutations } = await getHookExports();
      const { createTag } = useTagMutations();

      await createTag("finisher");

      const params = mockExecute.mock.calls[0]?.[1] as unknown[];
      expect(params[3]).toBeNull();
    });

    it("throws when name is empty after trimming", async () => {
      const { useTagMutations } = await getHookExports();
      const { createTag } = useTagMutations();

      await expect(createTag("   ")).rejects.toThrow(
        "Tag name cannot be empty"
      );
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it("throws when name is empty string", async () => {
      const { useTagMutations } = await getHookExports();
      const { createTag } = useTagMutations();

      await expect(createTag("")).rejects.toThrow("Tag name cannot be empty");
    });

    it("tracks tag_created event on success", async () => {
      const { trackEvent } = await import("@/lib/analytics");
      const { useTagMutations } = await getHookExports();
      const { createTag } = useTagMutations();

      await createTag("opener");

      expect(trackEvent).toHaveBeenCalledWith("tag_created");
    });

    it("wraps execution errors with descriptive message", async () => {
      mockExecute.mockRejectedValueOnce(new Error("Unique constraint"));
      const { useTagMutations } = await getHookExports();
      const { createTag } = useTagMutations();

      await expect(createTag("duplicate")).rejects.toThrow(
        "Failed to create tag: Unique constraint"
      );
    });

    it("throws when no authenticated user", async () => {
      const { authClient } = await import("@/auth/client");
      vi.mocked(authClient.useSession).mockReturnValue({
        data: null,
        isPending: false,
      } as ReturnType<typeof authClient.useSession>);

      const { useTagMutations } = await getHookExports();
      const { createTag } = useTagMutations();

      await expect(createTag("opener")).rejects.toThrow(
        "Cannot mutate tags without an authenticated user"
      );
    });
  });
});
