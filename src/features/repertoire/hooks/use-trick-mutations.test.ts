import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TagId, TrickId } from "@/db/types";

/** Cast a string literal to a branded ID type for test convenience. */
const trickId = (id: string) => id as TrickId;
const tagId = (id: string) => id as TagId;

// --- Mocks -----------------------------------------------------------

const mockExecute = vi.fn().mockResolvedValue({ rowsAffected: 0 });
const mockWriteTransaction = vi.fn(
  async (cb: (tx: { execute: typeof mockExecute }) => Promise<void>) => {
    await cb({ execute: mockExecute });
  }
);

vi.mock("@powersync/react", () => ({
  usePowerSync: vi.fn(() => ({
    execute: mockExecute,
    writeTransaction: mockWriteTransaction,
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

// Stable UUID for predictable assertions
let uuidCounter = 0;
vi.stubGlobal("crypto", {
  ...globalThis.crypto,
  randomUUID: () => `uuid-${++uuidCounter}`,
});

// --- Test suite -------------------------------------------------------

describe("use-trick-mutations", () => {
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

    // Restore default writeTransaction behavior
    mockWriteTransaction.mockImplementation(
      async (cb: (tx: { execute: typeof mockExecute }) => Promise<void>) => {
        await cb({ execute: mockExecute });
      }
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // We need to import after mocks are set up, so use dynamic import
  function getHookExports() {
    return import("./use-trick-mutations");
  }

  // --- Pure helper tests (via re-import of module internals) ----------

  // Since emptyToNull, booleanToInt, buildTrickParams are not exported,
  // we test them indirectly through the hook's SQL params.
  // But we can also import the module and test the hook end-to-end.

  describe("emptyToNull (indirect via createTrick params)", () => {
    it("converts empty string fields to null in SQL params", async () => {
      const { useTrickMutations } = await getHookExports();
      const { createTrick } = useTrickMutations();

      await createTrick(
        {
          name: "Card Warp",
          description: "",
          category: "",
          effectType: "",
          difficulty: null,
          status: "new",
          duration: null,
          performanceType: null,
          angleSensitivity: null,
          props: "",
          music: "",
          languages: [],
          isCameraFriendly: null,
          isSilent: null,
          notes: "",
          source: "",
          videoUrl: "",
        },
        []
      );

      const insertParams = mockExecute.mock.calls[0]?.[1] as unknown[];
      // description (index 3), category (4), effectType (5) should be null
      expect(insertParams[3]).toBeNull();
      expect(insertParams[4]).toBeNull();
      expect(insertParams[5]).toBeNull();
      // props (11), music (12), notes (16), source (17), videoUrl (18)
      expect(insertParams[11]).toBeNull();
      expect(insertParams[12]).toBeNull();
      expect(insertParams[16]).toBeNull();
      expect(insertParams[17]).toBeNull();
      expect(insertParams[18]).toBeNull();
    });

    it("keeps non-empty strings", async () => {
      const { useTrickMutations } = await getHookExports();
      const { createTrick } = useTrickMutations();

      await createTrick(
        {
          name: "Card Warp",
          description: "A cool trick",
          category: "Card",
          effectType: "Transformation",
          difficulty: null,
          status: "new",
          duration: null,
          performanceType: null,
          angleSensitivity: null,
          props: "Deck",
          music: "Ambient",
          languages: [],
          isCameraFriendly: null,
          isSilent: null,
          notes: "Practice slowly",
          source: "Book",
          videoUrl: "https://example.com",
        },
        []
      );

      const insertParams = mockExecute.mock.calls[0]?.[1] as unknown[];
      expect(insertParams[3]).toBe("A cool trick");
      expect(insertParams[4]).toBe("Card");
      expect(insertParams[5]).toBe("Transformation");
      expect(insertParams[11]).toBe("Deck");
      expect(insertParams[12]).toBe("Ambient");
      expect(insertParams[16]).toBe("Practice slowly");
      expect(insertParams[17]).toBe("Book");
      expect(insertParams[18]).toBe("https://example.com");
    });
  });

  describe("booleanToInt (indirect via createTrick params)", () => {
    it("converts true to 1", async () => {
      const { useTrickMutations } = await getHookExports();
      const { createTrick } = useTrickMutations();

      await createTrick(
        {
          name: "Trick",
          description: "",
          category: "",
          effectType: "",
          difficulty: null,
          status: "new",
          duration: null,
          performanceType: null,
          angleSensitivity: null,
          props: "",
          music: "",
          languages: [],
          isCameraFriendly: true,
          isSilent: true,
          notes: "",
          source: "",
          videoUrl: "",
        },
        []
      );

      const insertParams = mockExecute.mock.calls[0]?.[1] as unknown[];
      // isCameraFriendly (14), isSilent (15)
      expect(insertParams[14]).toBe(1);
      expect(insertParams[15]).toBe(1);
    });

    it("converts false to 0", async () => {
      const { useTrickMutations } = await getHookExports();
      const { createTrick } = useTrickMutations();

      await createTrick(
        {
          name: "Trick",
          description: "",
          category: "",
          effectType: "",
          difficulty: null,
          status: "new",
          duration: null,
          performanceType: null,
          angleSensitivity: null,
          props: "",
          music: "",
          languages: [],
          isCameraFriendly: false,
          isSilent: false,
          notes: "",
          source: "",
          videoUrl: "",
        },
        []
      );

      const insertParams = mockExecute.mock.calls[0]?.[1] as unknown[];
      expect(insertParams[14]).toBe(0);
      expect(insertParams[15]).toBe(0);
    });

    it("converts null to null", async () => {
      const { useTrickMutations } = await getHookExports();
      const { createTrick } = useTrickMutations();

      await createTrick(
        {
          name: "Trick",
          description: "",
          category: "",
          effectType: "",
          difficulty: null,
          status: "new",
          duration: null,
          performanceType: null,
          angleSensitivity: null,
          props: "",
          music: "",
          languages: [],
          isCameraFriendly: null,
          isSilent: null,
          notes: "",
          source: "",
          videoUrl: "",
        },
        []
      );

      const insertParams = mockExecute.mock.calls[0]?.[1] as unknown[];
      expect(insertParams[14]).toBeNull();
      expect(insertParams[15]).toBeNull();
    });
  });

  describe("buildTrickParams (indirect via createTrick)", () => {
    it("produces a 21-element array with correct values in correct positions", async () => {
      const { useTrickMutations } = await getHookExports();
      const { createTrick } = useTrickMutations();

      await createTrick(
        {
          name: "Ambitious Card",
          description: "A classic",
          category: "Card",
          effectType: "Transformation",
          difficulty: 3,
          status: "learning",
          duration: 120,
          performanceType: "close_up",
          angleSensitivity: "moderate",
          props: "Deck of cards",
          music: "None",
          languages: ["en", "fr"],
          isCameraFriendly: true,
          isSilent: false,
          notes: "Use Bicycle deck",
          source: "Card College",
          videoUrl: "https://example.com/video",
        },
        []
      );

      const params = mockExecute.mock.calls[0]?.[1] as unknown[];
      expect(params).toHaveLength(21);

      // Verify each position
      expect(params[0]).toBe("uuid-1"); // id
      expect(params[1]).toBe("user-123"); // userId
      expect(params[2]).toBe("Ambitious Card"); // name
      expect(params[3]).toBe("A classic"); // description
      expect(params[4]).toBe("Card"); // category
      expect(params[5]).toBe("Transformation"); // effectType
      expect(params[6]).toBe(3); // difficulty
      expect(params[7]).toBe("learning"); // status
      expect(params[8]).toBe(120); // duration
      expect(params[9]).toBe("close_up"); // performanceType
      expect(params[10]).toBe("moderate"); // angleSensitivity
      expect(params[11]).toBe("Deck of cards"); // props
      expect(params[12]).toBe("None"); // music
      expect(params[13]).toBe(JSON.stringify(["en", "fr"])); // languages
      expect(params[14]).toBe(1); // isCameraFriendly
      expect(params[15]).toBe(0); // isSilent
      expect(params[16]).toBe("Use Bicycle deck"); // notes
      expect(params[17]).toBe("Card College"); // source
      expect(params[18]).toBe("https://example.com/video"); // videoUrl
      expect(params[19]).toBe("2025-01-15T12:00:00.000Z"); // created_at
      expect(params[20]).toBe("2025-01-15T12:00:00.000Z"); // updated_at
    });

    it("serializes empty languages array as null", async () => {
      const { useTrickMutations } = await getHookExports();
      const { createTrick } = useTrickMutations();

      await createTrick(
        {
          name: "Trick",
          description: "",
          category: "",
          effectType: "",
          difficulty: null,
          status: "new",
          duration: null,
          performanceType: null,
          angleSensitivity: null,
          props: "",
          music: "",
          languages: [],
          isCameraFriendly: null,
          isSilent: null,
          notes: "",
          source: "",
          videoUrl: "",
        },
        []
      );

      const params = mockExecute.mock.calls[0]?.[1] as unknown[];
      expect(params[13]).toBeNull(); // languages
    });
  });

  describe("createTrick", () => {
    it("executes INSERT SQL within a write transaction", async () => {
      const { useTrickMutations } = await getHookExports();
      const { createTrick } = useTrickMutations();

      await createTrick(
        {
          name: "Trick",
          description: "",
          category: "",
          effectType: "",
          difficulty: null,
          status: "new",
          duration: null,
          performanceType: null,
          angleSensitivity: null,
          props: "",
          music: "",
          languages: [],
          isCameraFriendly: null,
          isSilent: null,
          notes: "",
          source: "",
          videoUrl: "",
        },
        []
      );

      expect(mockWriteTransaction).toHaveBeenCalledOnce();
      expect(mockExecute).toHaveBeenCalledOnce();

      const sql = mockExecute.mock.calls[0]?.[0] as string;
      expect(sql).toContain("INSERT INTO tricks");
    });

    it("returns the generated UUID", async () => {
      const { useTrickMutations } = await getHookExports();
      const { createTrick } = useTrickMutations();

      const id = await createTrick(
        {
          name: "Trick",
          description: "",
          category: "",
          effectType: "",
          difficulty: null,
          status: "new",
          duration: null,
          performanceType: null,
          angleSensitivity: null,
          props: "",
          music: "",
          languages: [],
          isCameraFriendly: null,
          isSilent: null,
          notes: "",
          source: "",
          videoUrl: "",
        },
        []
      );

      expect(id).toBe("uuid-1");
    });

    it("inserts tag junction rows when tagIds are provided", async () => {
      const { useTrickMutations } = await getHookExports();
      const { createTrick } = useTrickMutations();

      await createTrick(
        {
          name: "Trick",
          description: "",
          category: "",
          effectType: "",
          difficulty: null,
          status: "new",
          duration: null,
          performanceType: null,
          angleSensitivity: null,
          props: "",
          music: "",
          languages: [],
          isCameraFriendly: null,
          isSilent: null,
          notes: "",
          source: "",
          videoUrl: "",
        },
        [tagId("tag-a"), tagId("tag-b")]
      );

      // 1 trick INSERT + 2 tag junction INSERTs
      expect(mockExecute).toHaveBeenCalledTimes(3);

      const junctionSql = mockExecute.mock.calls[1]?.[0] as string;
      expect(junctionSql).toContain("INSERT INTO trick_tags");

      const junctionParams1 = mockExecute.mock.calls[1]?.[1] as unknown[];
      expect(junctionParams1).toContain("tag-a");

      const junctionParams2 = mockExecute.mock.calls[2]?.[1] as unknown[];
      expect(junctionParams2).toContain("tag-b");
    });

    it("tracks trick_created event on success", async () => {
      const { trackEvent } = await import("@/lib/analytics");
      const { useTrickMutations } = await getHookExports();
      const { createTrick } = useTrickMutations();

      await createTrick(
        {
          name: "Trick",
          description: "",
          category: "Card",
          effectType: "",
          difficulty: null,
          status: "learning",
          duration: null,
          performanceType: null,
          angleSensitivity: null,
          props: "",
          music: "",
          languages: [],
          isCameraFriendly: null,
          isSilent: null,
          notes: "",
          source: "",
          videoUrl: "",
        },
        []
      );

      expect(trackEvent).toHaveBeenCalledWith("trick_created", {
        category: "Card",
        status: "learning",
      });
    });

    it("wraps transaction errors with descriptive message", async () => {
      mockWriteTransaction.mockRejectedValueOnce(new Error("DB locked"));
      const { useTrickMutations } = await getHookExports();
      const { createTrick } = useTrickMutations();

      await expect(
        createTrick(
          {
            name: "Trick",
            description: "",
            category: "",
            effectType: "",
            difficulty: null,
            status: "new",
            duration: null,
            performanceType: null,
            angleSensitivity: null,
            props: "",
            music: "",
            languages: [],
            isCameraFriendly: null,
            isSilent: null,
            notes: "",
            source: "",
            videoUrl: "",
          },
          []
        )
      ).rejects.toThrow("Failed to create trick: DB locked");
    });

    it("throws when no authenticated user", async () => {
      const { authClient } = await import("@/auth/client");
      vi.mocked(authClient.useSession).mockReturnValue({
        data: null,
        isPending: false,
      } as ReturnType<typeof authClient.useSession>);

      const { useTrickMutations } = await getHookExports();
      const { createTrick } = useTrickMutations();

      await expect(
        createTrick(
          {
            name: "Trick",
            description: "",
            category: "",
            effectType: "",
            difficulty: null,
            status: "new",
            duration: null,
            performanceType: null,
            angleSensitivity: null,
            props: "",
            music: "",
            languages: [],
            isCameraFriendly: null,
            isSilent: null,
            notes: "",
            source: "",
            videoUrl: "",
          },
          []
        )
      ).rejects.toThrow("Cannot mutate tricks without an authenticated user");
    });
  });

  describe("updateTrick", () => {
    it("executes UPDATE SQL within a write transaction", async () => {
      const { useTrickMutations } = await getHookExports();
      const { updateTrick } = useTrickMutations();

      await updateTrick(
        trickId("trick-1"),
        {
          name: "Updated Trick",
          description: "Updated description",
          category: "Coin",
          effectType: "Vanish",
          difficulty: 4,
          status: "mastered",
          duration: 60,
          performanceType: "stage",
          angleSensitivity: "high",
          props: "Coins",
          music: "Dramatic",
          languages: ["en"],
          isCameraFriendly: false,
          isSilent: true,
          notes: "Updated notes",
          source: "Updated source",
          videoUrl: "https://updated.com",
        },
        [],
        []
      );

      expect(mockWriteTransaction).toHaveBeenCalledOnce();
      const sql = mockExecute.mock.calls[0]?.[0] as string;
      expect(sql).toContain("UPDATE tricks SET");
      expect(sql).toContain(
        "WHERE id = ? AND user_id = ? AND deleted_at IS NULL"
      );

      // Last two params are trick id and user id for WHERE clause
      const params = mockExecute.mock.calls[0]?.[1] as unknown[];
      expect(params.at(-2)).toBe("trick-1");
      expect(params.at(-1)).toBe("user-123");
    });

    it("soft-deletes removed tag associations", async () => {
      const { useTrickMutations } = await getHookExports();
      const { updateTrick } = useTrickMutations();

      await updateTrick(
        trickId("trick-1"),
        {
          name: "Trick",
          description: "",
          category: "",
          effectType: "",
          difficulty: null,
          status: "new",
          duration: null,
          performanceType: null,
          angleSensitivity: null,
          props: "",
          music: "",
          languages: [],
          isCameraFriendly: null,
          isSilent: null,
          notes: "",
          source: "",
          videoUrl: "",
        },
        [],
        [tagId("tag-remove")]
      );

      // 1 UPDATE trick + 1 soft-delete tag
      expect(mockExecute).toHaveBeenCalledTimes(2);
      const removeSql = mockExecute.mock.calls[1]?.[0] as string;
      expect(removeSql).toContain("UPDATE trick_tags SET deleted_at = ?");
      const removeParams = mockExecute.mock.calls[1]?.[1] as unknown[];
      expect(removeParams).toContain("tag-remove");
      expect(removeParams).toContain("trick-1");
    });

    it("restores soft-deleted tag association instead of inserting", async () => {
      // When the restore UPDATE affects a row, no INSERT should follow
      mockExecute
        .mockResolvedValueOnce({ rowsAffected: 0 }) // trick UPDATE
        .mockResolvedValueOnce({ rowsAffected: 1 }); // restore UPDATE hits a row

      const { useTrickMutations } = await getHookExports();
      const { updateTrick } = useTrickMutations();

      await updateTrick(
        trickId("trick-1"),
        {
          name: "Trick",
          description: "",
          category: "",
          effectType: "",
          difficulty: null,
          status: "new",
          duration: null,
          performanceType: null,
          angleSensitivity: null,
          props: "",
          music: "",
          languages: [],
          isCameraFriendly: null,
          isSilent: null,
          notes: "",
          source: "",
          videoUrl: "",
        },
        [tagId("tag-restore")],
        []
      );

      // 1 UPDATE trick + 1 restore UPDATE (no INSERT because rowsAffected > 0)
      expect(mockExecute).toHaveBeenCalledTimes(2);
      const restoreSql = mockExecute.mock.calls[1]?.[0] as string;
      expect(restoreSql).toContain("UPDATE trick_tags SET deleted_at = NULL");
      const restoreParams = mockExecute.mock.calls[1]?.[1] as unknown[];
      expect(restoreParams).toContain("tag-restore");
    });

    it("inserts new tag associations", async () => {
      const { useTrickMutations } = await getHookExports();
      const { updateTrick } = useTrickMutations();

      await updateTrick(
        trickId("trick-1"),
        {
          name: "Trick",
          description: "",
          category: "",
          effectType: "",
          difficulty: null,
          status: "new",
          duration: null,
          performanceType: null,
          angleSensitivity: null,
          props: "",
          music: "",
          languages: [],
          isCameraFriendly: null,
          isSilent: null,
          notes: "",
          source: "",
          videoUrl: "",
        },
        [tagId("tag-add")],
        []
      );

      // 1 UPDATE trick + 1 restore attempt (UPDATE trick_tags) + 1 INSERT tag junction
      expect(mockExecute).toHaveBeenCalledTimes(3);
      const restoreSql = mockExecute.mock.calls[1]?.[0] as string;
      expect(restoreSql).toContain("UPDATE trick_tags SET deleted_at = NULL");
      const addSql = mockExecute.mock.calls[2]?.[0] as string;
      expect(addSql).toContain("INSERT INTO trick_tags");
      const addParams = mockExecute.mock.calls[2]?.[1] as unknown[];
      expect(addParams).toContain("tag-add");
    });

    it("tracks trick_updated event on success", async () => {
      const { trackEvent } = await import("@/lib/analytics");
      const { useTrickMutations } = await getHookExports();
      const { updateTrick } = useTrickMutations();

      await updateTrick(
        trickId("trick-1"),
        {
          name: "Trick",
          description: "",
          category: "",
          effectType: "",
          difficulty: null,
          status: "new",
          duration: null,
          performanceType: null,
          angleSensitivity: null,
          props: "",
          music: "",
          languages: [],
          isCameraFriendly: null,
          isSilent: null,
          notes: "",
          source: "",
          videoUrl: "",
        },
        [],
        []
      );

      expect(trackEvent).toHaveBeenCalledWith("trick_updated");
    });

    it("wraps transaction errors with descriptive message", async () => {
      mockWriteTransaction.mockRejectedValueOnce(new Error("DB locked"));
      const { useTrickMutations } = await getHookExports();
      const { updateTrick } = useTrickMutations();

      await expect(
        updateTrick(
          trickId("trick-1"),
          {
            name: "Trick",
            description: "",
            category: "",
            effectType: "",
            difficulty: null,
            status: "new",
            duration: null,
            performanceType: null,
            angleSensitivity: null,
            props: "",
            music: "",
            languages: [],
            isCameraFriendly: null,
            isSilent: null,
            notes: "",
            source: "",
            videoUrl: "",
          },
          [],
          []
        )
      ).rejects.toThrow("Failed to update trick: DB locked");
    });

    it("throws when no authenticated user", async () => {
      const { authClient } = await import("@/auth/client");
      vi.mocked(authClient.useSession).mockReturnValue({
        data: null,
        isPending: false,
      } as ReturnType<typeof authClient.useSession>);

      const { useTrickMutations } = await getHookExports();
      const { updateTrick } = useTrickMutations();

      await expect(
        updateTrick(
          trickId("trick-1"),
          {
            name: "Trick",
            description: "",
            category: "",
            effectType: "",
            difficulty: null,
            status: "new",
            duration: null,
            performanceType: null,
            angleSensitivity: null,
            props: "",
            music: "",
            languages: [],
            isCameraFriendly: null,
            isSilent: null,
            notes: "",
            source: "",
            videoUrl: "",
          },
          [],
          []
        )
      ).rejects.toThrow("Cannot mutate tricks without an authenticated user");
    });
  });

  describe("deleteTrick", () => {
    it("executes soft-delete SQL", async () => {
      const { useTrickMutations } = await getHookExports();
      const { deleteTrick } = useTrickMutations();

      await deleteTrick(trickId("trick-1"));

      // 1 trick soft-delete + 1 trick_tags cascade soft-delete
      expect(mockExecute).toHaveBeenCalledTimes(2);

      const trickSql = mockExecute.mock.calls[0]?.[0] as string;
      expect(trickSql).toContain("UPDATE tricks SET deleted_at = ?");
      expect(trickSql).toContain("WHERE id = ?");
      expect(trickSql).toContain("user_id = ?");

      const trickParams = mockExecute.mock.calls[0]?.[1] as unknown[];
      expect(trickParams[0]).toBe("2025-01-15T12:00:00.000Z"); // deleted_at
      expect(trickParams[1]).toBe("2025-01-15T12:00:00.000Z"); // updated_at
      expect(trickParams[2]).toBe("trick-1"); // id
      expect(trickParams[3]).toBe("user-123"); // user_id

      const tagsSql = mockExecute.mock.calls[1]?.[0] as string;
      expect(tagsSql).toContain("UPDATE trick_tags SET deleted_at = ?");
      expect(tagsSql).toContain("WHERE trick_id = ?");
      expect(tagsSql).toContain("user_id = ?");

      const tagsParams = mockExecute.mock.calls[1]?.[1] as unknown[];
      expect(tagsParams).toContain("trick-1"); // trick_id
      expect(tagsParams).toContain("user-123"); // user_id
    });

    it("tracks trick_deleted event on success", async () => {
      const { trackEvent } = await import("@/lib/analytics");
      const { useTrickMutations } = await getHookExports();
      const { deleteTrick } = useTrickMutations();

      await deleteTrick(trickId("trick-1"));

      expect(trackEvent).toHaveBeenCalledWith("trick_deleted");
    });

    it("wraps execution errors with descriptive message", async () => {
      mockExecute.mockRejectedValueOnce(new Error("Connection lost"));
      const { useTrickMutations } = await getHookExports();
      const { deleteTrick } = useTrickMutations();

      await expect(deleteTrick(trickId("trick-1"))).rejects.toThrow(
        "Failed to delete trick: Connection lost"
      );
    });

    it("throws when no authenticated user", async () => {
      const { authClient } = await import("@/auth/client");
      vi.mocked(authClient.useSession).mockReturnValue({
        data: null,
        isPending: false,
      } as ReturnType<typeof authClient.useSession>);

      const { useTrickMutations } = await getHookExports();
      const { deleteTrick } = useTrickMutations();

      await expect(deleteTrick(trickId("trick-1"))).rejects.toThrow(
        "Cannot mutate tricks without an authenticated user"
      );
    });
  });
});
