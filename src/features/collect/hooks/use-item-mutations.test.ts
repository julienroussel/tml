import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemId, TagId, TrickId } from "@/db/types";

/** Cast a string literal to a branded ID type for test convenience. */
const itemId = (id: string) => id as ItemId;
const tagId = (id: string) => id as TagId;
const trickId = (id: string) => id as TrickId;

// --- Mocks -----------------------------------------------------------

const mockExecute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
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

describe("use-item-mutations", () => {
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

  function getHookExports() {
    return import("./use-item-mutations");
  }

  // --- createItem tests -----------------------------------------------

  describe("createItem", () => {
    it("executes INSERT SQL within a write transaction", async () => {
      const { useItemMutations } = await getHookExports();
      const { createItem } = useItemMutations();

      await createItem(
        {
          name: "Invisible Deck",
          type: "deck",
          description: "",
          brand: "",
          creator: "",
          condition: null,
          location: "",
          quantity: 1,
          purchaseDate: "",
          purchasePrice: "",
          url: "",
          notes: "",
        },
        [],
        []
      );

      expect(mockWriteTransaction).toHaveBeenCalledOnce();
      expect(mockExecute).toHaveBeenCalledOnce();

      const sql = mockExecute.mock.calls[0]?.[0] as string;
      expect(sql).toContain("INSERT INTO items");
    });

    it("returns the generated UUID", async () => {
      const { useItemMutations } = await getHookExports();
      const { createItem } = useItemMutations();

      const id = await createItem(
        {
          name: "Invisible Deck",
          type: "deck",
          description: "",
          brand: "",
          creator: "",
          condition: null,
          location: "",
          quantity: 1,
          purchaseDate: "",
          purchasePrice: "",
          url: "",
          notes: "",
        },
        [],
        []
      );

      expect(id).toBe("uuid-1");
    });

    it("produces INSERT params in correct column order", async () => {
      const { useItemMutations } = await getHookExports();
      const { createItem } = useItemMutations();

      await createItem(
        {
          name: "Ambitious Card",
          type: "deck",
          description: "A classic effect",
          brand: "Bicycle",
          creator: "Bob Ostin",
          condition: "new",
          location: "Close-up case",
          quantity: 2,
          purchaseDate: "2025-01-10",
          purchasePrice: "29.99",
          url: "https://example.com",
          notes: "Keep dry",
        },
        [],
        []
      );

      const params = mockExecute.mock.calls[0]?.[1] as unknown[];
      expect(params).toHaveLength(16);

      expect(params[0]).toBe("uuid-1"); // id
      expect(params[1]).toBe("user-123"); // user_id
      expect(params[2]).toBe("Ambitious Card"); // name
      expect(params[3]).toBe("deck"); // type
      expect(params[4]).toBe("A classic effect"); // description
      expect(params[5]).toBe("Bicycle"); // brand
      expect(params[6]).toBe("new"); // condition
      expect(params[7]).toBe("Close-up case"); // location
      expect(params[8]).toBe("Keep dry"); // notes
      expect(params[9]).toBe("2025-01-10"); // purchase_date
      expect(params[10]).toBe("29.99"); // purchase_price
      expect(params[11]).toBe(2); // quantity
      expect(params[12]).toBe("Bob Ostin"); // creator
      expect(params[13]).toBe("https://example.com"); // url
      expect(params[14]).toBe("2025-01-15T12:00:00.000Z"); // created_at
      expect(params[15]).toBe("2025-01-15T12:00:00.000Z"); // updated_at
    });

    it("converts empty string fields to null in SQL params", async () => {
      const { useItemMutations } = await getHookExports();
      const { createItem } = useItemMutations();

      await createItem(
        {
          name: "Item",
          type: "prop",
          description: "",
          brand: "",
          creator: "",
          condition: null,
          location: "",
          quantity: 1,
          purchaseDate: "",
          purchasePrice: "",
          url: "",
          notes: "",
        },
        [],
        []
      );

      const params = mockExecute.mock.calls[0]?.[1] as unknown[];
      // description (4), brand (5), location (7), notes (8), purchase_date (9),
      // purchase_price (10), creator (12), url (13)
      expect(params[4]).toBeNull(); // description
      expect(params[5]).toBeNull(); // brand
      expect(params[7]).toBeNull(); // location
      expect(params[8]).toBeNull(); // notes
      expect(params[9]).toBeNull(); // purchase_date
      expect(params[10]).toBeNull(); // purchase_price
      expect(params[12]).toBeNull(); // creator
      expect(params[13]).toBeNull(); // url
    });

    it("converts null condition to null in SQL params", async () => {
      const { useItemMutations } = await getHookExports();
      const { createItem } = useItemMutations();

      await createItem(
        {
          name: "Item",
          type: "prop",
          description: "",
          brand: "",
          creator: "",
          condition: null,
          location: "",
          quantity: 1,
          purchaseDate: "",
          purchasePrice: "",
          url: "",
          notes: "",
        },
        [],
        []
      );

      const params = mockExecute.mock.calls[0]?.[1] as unknown[];
      expect(params[6]).toBeNull(); // condition
    });

    it("inserts tag junction rows when tagIds are provided", async () => {
      const { useItemMutations } = await getHookExports();
      const { createItem } = useItemMutations();

      await createItem(
        {
          name: "Item",
          type: "prop",
          description: "",
          brand: "",
          creator: "",
          condition: null,
          location: "",
          quantity: 1,
          purchaseDate: "",
          purchasePrice: "",
          url: "",
          notes: "",
        },
        [tagId("tag-a"), tagId("tag-b")],
        []
      );

      // 1 item INSERT + 2 tag junction INSERTs
      expect(mockExecute).toHaveBeenCalledTimes(3);

      const junctionSql = mockExecute.mock.calls[1]?.[0] as string;
      expect(junctionSql).toContain("INSERT INTO item_tags");

      const junctionParams1 = mockExecute.mock.calls[1]?.[1] as unknown[];
      expect(junctionParams1).toContain("tag-a");

      const junctionParams2 = mockExecute.mock.calls[2]?.[1] as unknown[];
      expect(junctionParams2).toContain("tag-b");
    });

    it("includes user_id and item_id in tag junction params", async () => {
      const { useItemMutations } = await getHookExports();
      const { createItem } = useItemMutations();

      await createItem(
        {
          name: "Item",
          type: "prop",
          description: "",
          brand: "",
          creator: "",
          condition: null,
          location: "",
          quantity: 1,
          purchaseDate: "",
          purchasePrice: "",
          url: "",
          notes: "",
        },
        [tagId("tag-a")],
        []
      );

      const junctionParams = mockExecute.mock.calls[1]?.[1] as unknown[];
      // (id, user_id, item_id, tag_id, created_at, updated_at)
      expect(junctionParams[1]).toBe("user-123"); // user_id
      expect(junctionParams[2]).toBe("uuid-1"); // item_id (same as created item)
      expect(junctionParams[3]).toBe("tag-a"); // tag_id
    });

    it("inserts trick junction rows when trickIds are provided", async () => {
      const { useItemMutations } = await getHookExports();
      const { createItem } = useItemMutations();

      await createItem(
        {
          name: "Item",
          type: "prop",
          description: "",
          brand: "",
          creator: "",
          condition: null,
          location: "",
          quantity: 1,
          purchaseDate: "",
          purchasePrice: "",
          url: "",
          notes: "",
        },
        [],
        [trickId("trick-a"), trickId("trick-b")]
      );

      // 1 item INSERT + 2 trick junction INSERTs
      expect(mockExecute).toHaveBeenCalledTimes(3);

      const junctionSql = mockExecute.mock.calls[1]?.[0] as string;
      expect(junctionSql).toContain("INSERT INTO item_tricks");

      const junctionParams2 = mockExecute.mock.calls[2]?.[1] as unknown[];
      expect(junctionParams2).toContain("trick-b");
    });

    it("inserts both tag and trick junction rows", async () => {
      const { useItemMutations } = await getHookExports();
      const { createItem } = useItemMutations();

      await createItem(
        {
          name: "Item",
          type: "prop",
          description: "",
          brand: "",
          creator: "",
          condition: null,
          location: "",
          quantity: 1,
          purchaseDate: "",
          purchasePrice: "",
          url: "",
          notes: "",
        },
        [tagId("tag-a")],
        [trickId("trick-a")]
      );

      // 1 item INSERT + 1 tag junction + 1 trick junction
      expect(mockExecute).toHaveBeenCalledTimes(3);
    });

    it("tracks item_created event with type on success", async () => {
      const { trackEvent } = await import("@/lib/analytics");
      const { useItemMutations } = await getHookExports();
      const { createItem } = useItemMutations();

      await createItem(
        {
          name: "Item",
          type: "book",
          description: "",
          brand: "",
          creator: "",
          condition: null,
          location: "",
          quantity: 1,
          purchaseDate: "",
          purchasePrice: "",
          url: "",
          notes: "",
        },
        [],
        []
      );

      expect(trackEvent).toHaveBeenCalledWith("item_created", { type: "book" });
    });

    it("wraps transaction errors with descriptive message", async () => {
      mockWriteTransaction.mockRejectedValueOnce(new Error("DB locked"));
      const { useItemMutations } = await getHookExports();
      const { createItem } = useItemMutations();

      await expect(
        createItem(
          {
            name: "Item",
            type: "prop",
            description: "",
            brand: "",
            creator: "",
            condition: null,
            location: "",
            quantity: 1,
            purchaseDate: "",
            purchasePrice: "",
            url: "",
            notes: "",
          },
          [],
          []
        )
      ).rejects.toThrow("Failed to create item: DB locked");
    });

    it("throws when no authenticated user", async () => {
      const { authClient } = await import("@/auth/client");
      vi.mocked(authClient.useSession).mockReturnValue({
        data: null,
        isPending: false,
      } as ReturnType<typeof authClient.useSession>);

      const { useItemMutations } = await getHookExports();
      const { createItem } = useItemMutations();

      await expect(
        createItem(
          {
            name: "Item",
            type: "prop",
            description: "",
            brand: "",
            creator: "",
            condition: null,
            location: "",
            quantity: 1,
            purchaseDate: "",
            purchasePrice: "",
            url: "",
            notes: "",
          },
          [],
          []
        )
      ).rejects.toThrow("Cannot mutate items without an authenticated user");
    });

    it("throws when tagIds exceed MAX_TAGS_PER_ITEM", async () => {
      const { useItemMutations } = await getHookExports();
      const { createItem } = useItemMutations();

      const tooManyTags = Array.from({ length: 21 }, (_, i) =>
        tagId(`tag-${i}`)
      );

      await expect(
        createItem(
          {
            name: "Item",
            type: "prop",
            description: "",
            brand: "",
            creator: "",
            condition: null,
            location: "",
            quantity: 1,
            purchaseDate: "",
            purchasePrice: "",
            url: "",
            notes: "",
          },
          tooManyTags,
          []
        )
      ).rejects.toThrow("MAX_TAGS");
      expect(mockWriteTransaction).not.toHaveBeenCalled();
    });

    it("wraps non-Error exceptions with unknown error message", async () => {
      mockWriteTransaction.mockRejectedValueOnce(42);
      const { useItemMutations } = await getHookExports();
      const { createItem } = useItemMutations();

      await expect(
        createItem(
          {
            name: "Item",
            type: "prop",
            description: "",
            brand: "",
            creator: "",
            condition: null,
            location: "",
            quantity: 1,
            purchaseDate: "",
            purchasePrice: "",
            url: "",
            notes: "",
          },
          [],
          []
        )
      ).rejects.toThrow("Failed to create item: Unknown error creating item");
    });

    it("converts whitespace-only fields to null via emptyToNull", async () => {
      const { useItemMutations } = await getHookExports();
      const { createItem } = useItemMutations();

      await createItem(
        {
          name: "Item",
          type: "prop",
          description: "   ",
          brand: "\t",
          creator: "\n",
          condition: null,
          location: "  \t  ",
          quantity: 1,
          purchaseDate: " ",
          purchasePrice: "  ",
          url: "   ",
          notes: "\n\t",
        },
        [],
        []
      );

      const params = mockExecute.mock.calls[0]?.[1] as unknown[];
      expect(params[4]).toBeNull(); // description
      expect(params[5]).toBeNull(); // brand
      expect(params[7]).toBeNull(); // location
      expect(params[8]).toBeNull(); // notes
      expect(params[9]).toBeNull(); // purchase_date
      expect(params[10]).toBeNull(); // purchase_price
      expect(params[12]).toBeNull(); // creator
      expect(params[13]).toBeNull(); // url
    });

    it("accepts exactly MAX_TAGS_PER_ITEM tags without throwing", async () => {
      const { useItemMutations } = await getHookExports();
      const { createItem } = useItemMutations();

      const exactLimitTags = Array.from({ length: 20 }, (_, i) =>
        tagId(`tag-${i}`)
      );

      await createItem(
        {
          name: "Item",
          type: "prop",
          description: "",
          brand: "",
          creator: "",
          condition: null,
          location: "",
          quantity: 1,
          purchaseDate: "",
          purchasePrice: "",
          url: "",
          notes: "",
        },
        exactLimitTags,
        []
      );

      // 1 item INSERT + 20 tag junction INSERTs
      expect(mockExecute).toHaveBeenCalledTimes(21);
    });

    it("throws when trickIds exceed MAX_TRICKS_PER_ITEM", async () => {
      const { useItemMutations } = await getHookExports();
      const { createItem } = useItemMutations();

      const tooManyTricks = Array.from({ length: 51 }, (_, i) =>
        trickId(`trick-${i}`)
      );

      await expect(
        createItem(
          {
            name: "Item",
            type: "prop",
            description: "",
            brand: "",
            creator: "",
            condition: null,
            location: "",
            quantity: 1,
            purchaseDate: "",
            purchasePrice: "",
            url: "",
            notes: "",
          },
          [],
          tooManyTricks
        )
      ).rejects.toThrow("MAX_TRICKS");
      expect(mockWriteTransaction).not.toHaveBeenCalled();
    });
  });

  // --- updateItem tests -----------------------------------------------

  describe("updateItem", () => {
    it("executes UPDATE SQL within a write transaction", async () => {
      const { useItemMutations } = await getHookExports();
      const { updateItem } = useItemMutations();

      await updateItem(
        itemId("item-1"),
        {
          name: "Updated Item",
          type: "book",
          description: "Updated description",
          brand: "Theory11",
          creator: "Someone",
          condition: "good",
          location: "Stage case",
          quantity: 3,
          purchaseDate: "2025-02-01",
          purchasePrice: "49.99",
          url: "https://example.com/updated",
          notes: "Updated notes",
        },
        [],
        [],
        [],
        []
      );

      expect(mockWriteTransaction).toHaveBeenCalledOnce();
      const sql = mockExecute.mock.calls[0]?.[0] as string;
      expect(sql).toContain("UPDATE items SET");
      expect(sql).toContain(
        "WHERE id = ? AND user_id = ? AND deleted_at IS NULL"
      );
    });

    it("places item id and user_id as last WHERE clause params", async () => {
      const { useItemMutations } = await getHookExports();
      const { updateItem } = useItemMutations();

      await updateItem(
        itemId("item-1"),
        {
          name: "Item",
          type: "prop",
          description: "",
          brand: "",
          creator: "",
          condition: null,
          location: "",
          quantity: 1,
          purchaseDate: "",
          purchasePrice: "",
          url: "",
          notes: "",
        },
        [],
        [],
        [],
        []
      );

      const params = mockExecute.mock.calls[0]?.[1] as unknown[];
      expect(params.at(-2)).toBe("item-1"); // id
      expect(params.at(-1)).toBe("user-123"); // user_id
    });

    it("soft-deletes removed tag associations", async () => {
      const { useItemMutations } = await getHookExports();
      const { updateItem } = useItemMutations();

      await updateItem(
        itemId("item-1"),
        {
          name: "Item",
          type: "prop",
          description: "",
          brand: "",
          creator: "",
          condition: null,
          location: "",
          quantity: 1,
          purchaseDate: "",
          purchasePrice: "",
          url: "",
          notes: "",
        },
        [],
        [tagId("tag-remove")],
        [],
        []
      );

      // 1 UPDATE item + 1 soft-delete tag
      expect(mockExecute).toHaveBeenCalledTimes(2);
      const removeSql = mockExecute.mock.calls[1]?.[0] as string;
      expect(removeSql).toContain("UPDATE item_tags SET deleted_at = ?");
      const removeParams = mockExecute.mock.calls[1]?.[1] as unknown[];
      expect(removeParams).toContain("tag-remove");
      expect(removeParams).toContain("item-1");
    });

    it("restores soft-deleted tag association instead of inserting", async () => {
      // When the restore UPDATE affects a row, no INSERT should follow
      mockExecute
        .mockResolvedValueOnce({ rowsAffected: 1 }) // item UPDATE
        .mockResolvedValueOnce({ rowsAffected: 1 }); // restore UPDATE hits a row

      const { useItemMutations } = await getHookExports();
      const { updateItem } = useItemMutations();

      await updateItem(
        itemId("item-1"),
        {
          name: "Item",
          type: "prop",
          description: "",
          brand: "",
          creator: "",
          condition: null,
          location: "",
          quantity: 1,
          purchaseDate: "",
          purchasePrice: "",
          url: "",
          notes: "",
        },
        [tagId("tag-restore")],
        [],
        [],
        []
      );

      // 1 UPDATE item + 1 restore UPDATE (no INSERT because rowsAffected > 0)
      expect(mockExecute).toHaveBeenCalledTimes(2);
      const restoreSql = mockExecute.mock.calls[1]?.[0] as string;
      expect(restoreSql).toContain("UPDATE item_tags SET deleted_at = NULL");
      const restoreParams = mockExecute.mock.calls[1]?.[1] as unknown[];
      expect(restoreParams).toContain("tag-restore");
    });

    it("inserts new tag association when no soft-deleted row exists", async () => {
      mockExecute
        .mockResolvedValueOnce({ rowsAffected: 1 }) // item UPDATE
        .mockResolvedValueOnce({ rowsAffected: 0 }); // restore UPDATE finds no row

      const { useItemMutations } = await getHookExports();
      const { updateItem } = useItemMutations();

      await updateItem(
        itemId("item-1"),
        {
          name: "Item",
          type: "prop",
          description: "",
          brand: "",
          creator: "",
          condition: null,
          location: "",
          quantity: 1,
          purchaseDate: "",
          purchasePrice: "",
          url: "",
          notes: "",
        },
        [tagId("tag-add")],
        [],
        [],
        []
      );

      // 1 UPDATE item + 1 restore attempt (UPDATE item_tags) + 1 INSERT tag junction
      expect(mockExecute).toHaveBeenCalledTimes(3);
      const restoreSql = mockExecute.mock.calls[1]?.[0] as string;
      expect(restoreSql).toContain("UPDATE item_tags SET deleted_at = NULL");
      const addSql = mockExecute.mock.calls[2]?.[0] as string;
      expect(addSql).toContain("INSERT INTO item_tags");
      const addParams = mockExecute.mock.calls[2]?.[1] as unknown[];
      expect(addParams).toContain("tag-add");
    });

    it("soft-deletes removed trick associations", async () => {
      const { useItemMutations } = await getHookExports();
      const { updateItem } = useItemMutations();

      await updateItem(
        itemId("item-1"),
        {
          name: "Item",
          type: "prop",
          description: "",
          brand: "",
          creator: "",
          condition: null,
          location: "",
          quantity: 1,
          purchaseDate: "",
          purchasePrice: "",
          url: "",
          notes: "",
        },
        [],
        [],
        [],
        [trickId("trick-remove")]
      );

      // 1 UPDATE item + 1 soft-delete trick
      expect(mockExecute).toHaveBeenCalledTimes(2);
      const removeSql = mockExecute.mock.calls[1]?.[0] as string;
      expect(removeSql).toContain("UPDATE item_tricks SET deleted_at = ?");
      const removeParams = mockExecute.mock.calls[1]?.[1] as unknown[];
      expect(removeParams).toContain("trick-remove");
      expect(removeParams).toContain("item-1");
    });

    it("restores soft-deleted trick association instead of inserting", async () => {
      mockExecute
        .mockResolvedValueOnce({ rowsAffected: 1 }) // item UPDATE
        .mockResolvedValueOnce({ rowsAffected: 1 }); // restore UPDATE hits a row

      const { useItemMutations } = await getHookExports();
      const { updateItem } = useItemMutations();

      await updateItem(
        itemId("item-1"),
        {
          name: "Item",
          type: "prop",
          description: "",
          brand: "",
          creator: "",
          condition: null,
          location: "",
          quantity: 1,
          purchaseDate: "",
          purchasePrice: "",
          url: "",
          notes: "",
        },
        [],
        [],
        [trickId("trick-restore")],
        []
      );

      expect(mockExecute).toHaveBeenCalledTimes(2);
      const restoreSql = mockExecute.mock.calls[1]?.[0] as string;
      expect(restoreSql).toContain("UPDATE item_tricks SET deleted_at = NULL");
      const restoreParams = mockExecute.mock.calls[1]?.[1] as unknown[];
      expect(restoreParams).toContain("trick-restore");
    });

    it("inserts new trick association when no soft-deleted row exists", async () => {
      mockExecute
        .mockResolvedValueOnce({ rowsAffected: 1 }) // item UPDATE
        .mockResolvedValueOnce({ rowsAffected: 0 }); // restore UPDATE finds no row

      const { useItemMutations } = await getHookExports();
      const { updateItem } = useItemMutations();

      await updateItem(
        itemId("item-1"),
        {
          name: "Item",
          type: "prop",
          description: "",
          brand: "",
          creator: "",
          condition: null,
          location: "",
          quantity: 1,
          purchaseDate: "",
          purchasePrice: "",
          url: "",
          notes: "",
        },
        [],
        [],
        [trickId("trick-add")],
        []
      );

      // 1 UPDATE item + 1 restore attempt + 1 INSERT trick junction
      expect(mockExecute).toHaveBeenCalledTimes(3);
      const addSql = mockExecute.mock.calls[2]?.[0] as string;
      expect(addSql).toContain("INSERT INTO item_tricks");
      const addParams = mockExecute.mock.calls[2]?.[1] as unknown[];
      expect(addParams).toContain("trick-add");
    });

    it("tracks item_updated event on success", async () => {
      const { trackEvent } = await import("@/lib/analytics");
      const { useItemMutations } = await getHookExports();
      const { updateItem } = useItemMutations();

      await updateItem(
        itemId("item-1"),
        {
          name: "Item",
          type: "prop",
          description: "",
          brand: "",
          creator: "",
          condition: null,
          location: "",
          quantity: 1,
          purchaseDate: "",
          purchasePrice: "",
          url: "",
          notes: "",
        },
        [],
        [],
        [],
        []
      );

      expect(trackEvent).toHaveBeenCalledWith("item_updated");
    });

    it("wraps transaction errors with descriptive message", async () => {
      mockWriteTransaction.mockRejectedValueOnce(new Error("DB locked"));
      const { useItemMutations } = await getHookExports();
      const { updateItem } = useItemMutations();

      await expect(
        updateItem(
          itemId("item-1"),
          {
            name: "Item",
            type: "prop",
            description: "",
            brand: "",
            creator: "",
            condition: null,
            location: "",
            quantity: 1,
            purchaseDate: "",
            purchasePrice: "",
            url: "",
            notes: "",
          },
          [],
          [],
          [],
          []
        )
      ).rejects.toThrow("Failed to update item: DB locked");
    });

    it("throws when no authenticated user", async () => {
      const { authClient } = await import("@/auth/client");
      vi.mocked(authClient.useSession).mockReturnValue({
        data: null,
        isPending: false,
      } as ReturnType<typeof authClient.useSession>);

      const { useItemMutations } = await getHookExports();
      const { updateItem } = useItemMutations();

      await expect(
        updateItem(
          itemId("item-1"),
          {
            name: "Item",
            type: "prop",
            description: "",
            brand: "",
            creator: "",
            condition: null,
            location: "",
            quantity: 1,
            purchaseDate: "",
            purchasePrice: "",
            url: "",
            notes: "",
          },
          [],
          [],
          [],
          []
        )
      ).rejects.toThrow("Cannot mutate items without an authenticated user");
    });

    it("throws when item not found or already deleted", async () => {
      mockExecute.mockResolvedValueOnce({ rowsAffected: 0 });
      const { useItemMutations } = await getHookExports();
      const { updateItem } = useItemMutations();

      await expect(
        updateItem(
          itemId("item-1"),
          {
            name: "Item",
            type: "prop",
            description: "",
            brand: "",
            creator: "",
            condition: null,
            location: "",
            quantity: 1,
            purchaseDate: "",
            purchasePrice: "",
            url: "",
            notes: "",
          },
          [],
          [],
          [],
          []
        )
      ).rejects.toThrow("ITEM_NOT_FOUND");
    });

    it("applies combined tag and trick add+remove diffs without cross-contamination", async () => {
      mockExecute
        .mockResolvedValueOnce({ rowsAffected: 1 }) // 0: item UPDATE
        .mockResolvedValueOnce({ rowsAffected: 1 }) // 1: soft-delete tag-remove
        .mockResolvedValueOnce({ rowsAffected: 0 }) // 2: restore tag-add (no row)
        .mockResolvedValueOnce({ rowsAffected: 1 }) // 3: INSERT tag-add
        .mockResolvedValueOnce({ rowsAffected: 1 }) // 4: soft-delete trick-remove
        .mockResolvedValueOnce({ rowsAffected: 0 }) // 5: restore trick-add (no row)
        .mockResolvedValueOnce({ rowsAffected: 1 }); // 6: INSERT trick-add

      const { useItemMutations } = await getHookExports();
      const { updateItem } = useItemMutations();

      await updateItem(
        itemId("item-1"),
        {
          name: "Item",
          type: "prop",
          description: "",
          brand: "",
          creator: "",
          condition: null,
          location: "",
          quantity: 1,
          purchaseDate: "",
          purchasePrice: "",
          url: "",
          notes: "",
        },
        [tagId("tag-add")],
        [tagId("tag-remove")],
        [trickId("trick-add")],
        [trickId("trick-remove")]
      );

      expect(mockExecute).toHaveBeenCalledTimes(7);

      // Item UPDATE first
      expect(mockExecute.mock.calls[0]?.[0]).toContain("UPDATE items SET");

      // Tag operations: remove first, then restore-attempt, then INSERT
      const tagRemoveSql = mockExecute.mock.calls[1]?.[0] as string;
      expect(tagRemoveSql).toContain("UPDATE item_tags SET deleted_at = ?");
      expect(mockExecute.mock.calls[1]?.[1]).toContain("tag-remove");

      const tagRestoreSql = mockExecute.mock.calls[2]?.[0] as string;
      expect(tagRestoreSql).toContain("UPDATE item_tags SET deleted_at = NULL");
      expect(mockExecute.mock.calls[2]?.[1]).toContain("tag-add");

      const tagInsertSql = mockExecute.mock.calls[3]?.[0] as string;
      expect(tagInsertSql).toContain("INSERT INTO item_tags");
      expect(mockExecute.mock.calls[3]?.[1]).toContain("tag-add");

      // Trick operations: remove first, then restore-attempt, then INSERT
      const trickRemoveSql = mockExecute.mock.calls[4]?.[0] as string;
      expect(trickRemoveSql).toContain("UPDATE item_tricks SET deleted_at = ?");
      expect(mockExecute.mock.calls[4]?.[1]).toContain("trick-remove");

      const trickRestoreSql = mockExecute.mock.calls[5]?.[0] as string;
      expect(trickRestoreSql).toContain(
        "UPDATE item_tricks SET deleted_at = NULL"
      );
      expect(mockExecute.mock.calls[5]?.[1]).toContain("trick-add");

      const trickInsertSql = mockExecute.mock.calls[6]?.[0] as string;
      expect(trickInsertSql).toContain("INSERT INTO item_tricks");
      expect(mockExecute.mock.calls[6]?.[1]).toContain("trick-add");
    });

    it("handles same trick ID in both addTrickIds and removeTrickIds (soft-deletes then restores)", async () => {
      mockExecute
        .mockResolvedValueOnce({ rowsAffected: 1 }) // item UPDATE
        .mockResolvedValueOnce({ rowsAffected: 1 }) // soft-delete trick-a
        .mockResolvedValueOnce({ rowsAffected: 1 }); // restore trick-a

      const { useItemMutations } = await getHookExports();
      const { updateItem } = useItemMutations();

      await updateItem(
        itemId("item-1"),
        {
          name: "Item",
          type: "prop",
          description: "",
          brand: "",
          creator: "",
          condition: null,
          location: "",
          quantity: 1,
          purchaseDate: "",
          purchasePrice: "",
          url: "",
          notes: "",
        },
        [],
        [],
        [trickId("trick-a")],
        [trickId("trick-a")]
      );

      expect(mockExecute).toHaveBeenCalledTimes(3);

      const softDeleteSql = mockExecute.mock.calls[1]?.[0] as string;
      expect(softDeleteSql).toContain("UPDATE item_tricks SET deleted_at = ?");
      expect(mockExecute.mock.calls[1]?.[1]).toContain("trick-a");

      const restoreSql = mockExecute.mock.calls[2]?.[0] as string;
      expect(restoreSql).toContain("UPDATE item_tricks SET deleted_at = NULL");
      expect(mockExecute.mock.calls[2]?.[1]).toContain("trick-a");
    });

    it("short-circuits junction operations when item UPDATE rowsAffected is 0", async () => {
      mockExecute.mockResolvedValueOnce({ rowsAffected: 0 });

      const { useItemMutations } = await getHookExports();
      const { updateItem } = useItemMutations();

      await expect(
        updateItem(
          itemId("item-1"),
          {
            name: "Item",
            type: "prop",
            description: "",
            brand: "",
            creator: "",
            condition: null,
            location: "",
            quantity: 1,
            purchaseDate: "",
            purchasePrice: "",
            url: "",
            notes: "",
          },
          [tagId("tag-a")],
          [tagId("tag-b")],
          [trickId("trick-a")],
          [trickId("trick-b")]
        )
      ).rejects.toThrow("ITEM_NOT_FOUND");

      // Only the item UPDATE should have run; junction diffs must not execute
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute.mock.calls[0]?.[0]).toContain("UPDATE items SET");
    });

    it("handles same tag ID in both addTagIds and removeTagIds (soft-deletes then restores)", async () => {
      mockExecute
        .mockResolvedValueOnce({ rowsAffected: 1 }) // item UPDATE
        .mockResolvedValueOnce({ rowsAffected: 1 }) // soft-delete tag-a
        .mockResolvedValueOnce({ rowsAffected: 1 }); // restore tag-a (hits the just-deleted row)

      const { useItemMutations } = await getHookExports();
      const { updateItem } = useItemMutations();

      await updateItem(
        itemId("item-1"),
        {
          name: "Item",
          type: "prop",
          description: "",
          brand: "",
          creator: "",
          condition: null,
          location: "",
          quantity: 1,
          purchaseDate: "",
          purchasePrice: "",
          url: "",
          notes: "",
        },
        [tagId("tag-a")],
        [tagId("tag-a")],
        [],
        []
      );

      // 1 item UPDATE + 1 soft-delete + 1 restore (no INSERT since restore succeeded)
      expect(mockExecute).toHaveBeenCalledTimes(3);

      const softDeleteSql = mockExecute.mock.calls[1]?.[0] as string;
      expect(softDeleteSql).toContain("UPDATE item_tags SET deleted_at = ?");
      const softDeleteParams = mockExecute.mock.calls[1]?.[1] as unknown[];
      expect(softDeleteParams).toContain("tag-a");

      const restoreSql = mockExecute.mock.calls[2]?.[0] as string;
      expect(restoreSql).toContain("UPDATE item_tags SET deleted_at = NULL");
      const restoreParams = mockExecute.mock.calls[2]?.[1] as unknown[];
      expect(restoreParams).toContain("tag-a");
    });

    it("produces UPDATE params in correct column order", async () => {
      const { useItemMutations } = await getHookExports();
      const { updateItem } = useItemMutations();

      await updateItem(
        itemId("item-1"),
        {
          name: "Ambitious Card",
          type: "deck",
          description: "A classic effect",
          brand: "Bicycle",
          creator: "Bob Ostin",
          condition: "new",
          location: "Close-up case",
          quantity: 2,
          purchaseDate: "2025-01-10",
          purchasePrice: "29.99",
          url: "https://example.com",
          notes: "Keep dry",
        },
        [],
        [],
        [],
        []
      );

      const params = mockExecute.mock.calls[0]?.[1] as unknown[];
      expect(params).toHaveLength(16);

      expect(params[0]).toBe("user-123"); // user_id
      expect(params[1]).toBe("Ambitious Card"); // name
      expect(params[2]).toBe("deck"); // type
      expect(params[3]).toBe("A classic effect"); // description
      expect(params[4]).toBe("Bicycle"); // brand
      expect(params[5]).toBe("new"); // condition
      expect(params[6]).toBe("Close-up case"); // location
      expect(params[7]).toBe("Keep dry"); // notes
      expect(params[8]).toBe("2025-01-10"); // purchase_date
      expect(params[9]).toBe("29.99"); // purchase_price
      expect(params[10]).toBe(2); // quantity
      expect(params[11]).toBe("Bob Ostin"); // creator
      expect(params[12]).toBe("https://example.com"); // url
      expect(params[13]).toBe("2025-01-15T12:00:00.000Z"); // updated_at
      expect(params[14]).toBe("item-1"); // id (WHERE)
      expect(params[15]).toBe("user-123"); // user_id (WHERE)
    });

    it("wraps non-Error exceptions with unknown error message", async () => {
      mockWriteTransaction.mockRejectedValueOnce("string error");
      const { useItemMutations } = await getHookExports();
      const { updateItem } = useItemMutations();

      await expect(
        updateItem(
          itemId("item-1"),
          {
            name: "Item",
            type: "prop",
            description: "",
            brand: "",
            creator: "",
            condition: null,
            location: "",
            quantity: 1,
            purchaseDate: "",
            purchasePrice: "",
            url: "",
            notes: "",
          },
          [],
          [],
          [],
          []
        )
      ).rejects.toThrow("Failed to update item: Unknown error updating item");
    });

    it("throws when addTagIds exceed MAX_TAGS_PER_ITEM", async () => {
      const { useItemMutations } = await getHookExports();
      const { updateItem } = useItemMutations();

      const tooManyTags = Array.from({ length: 21 }, (_, i) =>
        tagId(`tag-${i}`)
      );

      await expect(
        updateItem(
          itemId("item-1"),
          {
            name: "Item",
            type: "prop",
            description: "",
            brand: "",
            creator: "",
            condition: null,
            location: "",
            quantity: 1,
            purchaseDate: "",
            purchasePrice: "",
            url: "",
            notes: "",
          },
          tooManyTags,
          [],
          [],
          []
        )
      ).rejects.toThrow("MAX_TAGS");
      expect(mockWriteTransaction).not.toHaveBeenCalled();
    });

    it("throws when addTrickIds exceed MAX_TRICKS_PER_ITEM", async () => {
      const { useItemMutations } = await getHookExports();
      const { updateItem } = useItemMutations();

      const tooManyTricks = Array.from({ length: 51 }, (_, i) =>
        trickId(`trick-${i}`)
      );

      await expect(
        updateItem(
          itemId("item-1"),
          {
            name: "Item",
            type: "prop",
            description: "",
            brand: "",
            creator: "",
            condition: null,
            location: "",
            quantity: 1,
            purchaseDate: "",
            purchasePrice: "",
            url: "",
            notes: "",
          },
          [],
          [],
          tooManyTricks,
          []
        )
      ).rejects.toThrow("MAX_TRICKS");
      expect(mockWriteTransaction).not.toHaveBeenCalled();
    });
  });

  // --- deleteItem tests -----------------------------------------------

  describe("deleteItem", () => {
    it("soft-deletes item, item_tags, and item_tricks in one transaction", async () => {
      const { useItemMutations } = await getHookExports();
      const { deleteItem } = useItemMutations();

      await deleteItem(itemId("item-1"));

      // 1 item soft-delete + 1 item_tags cascade + 1 item_tricks cascade
      expect(mockExecute).toHaveBeenCalledTimes(3);
    });

    it("soft-deletes the item row with correct params", async () => {
      const { useItemMutations } = await getHookExports();
      const { deleteItem } = useItemMutations();

      await deleteItem(itemId("item-1"));

      const itemSql = mockExecute.mock.calls[0]?.[0] as string;
      expect(itemSql).toContain("UPDATE items SET deleted_at = ?");
      expect(itemSql).toContain("WHERE id = ?");
      expect(itemSql).toContain("user_id = ?");

      const itemParams = mockExecute.mock.calls[0]?.[1] as unknown[];
      expect(itemParams[0]).toBe("2025-01-15T12:00:00.000Z"); // deleted_at
      expect(itemParams[1]).toBe("2025-01-15T12:00:00.000Z"); // updated_at
      expect(itemParams[2]).toBe("item-1"); // id
      expect(itemParams[3]).toBe("user-123"); // user_id
    });

    it("soft-deletes item_tags rows with correct params", async () => {
      const { useItemMutations } = await getHookExports();
      const { deleteItem } = useItemMutations();

      await deleteItem(itemId("item-1"));

      const tagsSql = mockExecute.mock.calls[1]?.[0] as string;
      expect(tagsSql).toContain("UPDATE item_tags SET deleted_at = ?");
      expect(tagsSql).toContain("WHERE item_id = ?");
      expect(tagsSql).toContain("user_id = ?");

      const tagsParams = mockExecute.mock.calls[1]?.[1] as unknown[];
      expect(tagsParams).toContain("item-1"); // item_id
      expect(tagsParams).toContain("user-123"); // user_id
    });

    it("soft-deletes item_tricks rows with correct params", async () => {
      const { useItemMutations } = await getHookExports();
      const { deleteItem } = useItemMutations();

      await deleteItem(itemId("item-1"));

      const tricksSql = mockExecute.mock.calls[2]?.[0] as string;
      expect(tricksSql).toContain("UPDATE item_tricks SET deleted_at = ?");
      expect(tricksSql).toContain("WHERE item_id = ?");
      expect(tricksSql).toContain("user_id = ?");

      const tricksParams = mockExecute.mock.calls[2]?.[1] as unknown[];
      expect(tricksParams).toContain("item-1"); // item_id
      expect(tricksParams).toContain("user-123"); // user_id
    });

    it("sets deleted_at only on non-deleted rows", async () => {
      const { useItemMutations } = await getHookExports();
      const { deleteItem } = useItemMutations();

      await deleteItem(itemId("item-1"));

      const itemSql = mockExecute.mock.calls[0]?.[0] as string;
      expect(itemSql).toContain("deleted_at IS NULL");
    });

    it("throws when item not found or already deleted", async () => {
      mockExecute.mockResolvedValueOnce({ rowsAffected: 0 });
      const { useItemMutations } = await getHookExports();
      const { deleteItem } = useItemMutations();

      await expect(deleteItem(itemId("item-1"))).rejects.toThrow(
        "ITEM_NOT_FOUND"
      );
    });

    it("tracks item_deleted event on success", async () => {
      const { trackEvent } = await import("@/lib/analytics");
      const { useItemMutations } = await getHookExports();
      const { deleteItem } = useItemMutations();

      await deleteItem(itemId("item-1"));

      expect(trackEvent).toHaveBeenCalledWith("item_deleted");
    });

    it("wraps execution errors with descriptive message", async () => {
      mockExecute.mockRejectedValueOnce(new Error("Connection lost"));
      const { useItemMutations } = await getHookExports();
      const { deleteItem } = useItemMutations();

      await expect(deleteItem(itemId("item-1"))).rejects.toThrow(
        "Failed to delete item: Connection lost"
      );
    });

    it("wraps non-Error exceptions with unknown error message", async () => {
      mockWriteTransaction.mockRejectedValueOnce("something went wrong");
      const { useItemMutations } = await getHookExports();
      const { deleteItem } = useItemMutations();

      await expect(deleteItem(itemId("item-1"))).rejects.toThrow(
        "Failed to delete item: Unknown error deleting item"
      );
    });

    it("throws when no authenticated user", async () => {
      const { authClient } = await import("@/auth/client");
      vi.mocked(authClient.useSession).mockReturnValue({
        data: null,
        isPending: false,
      } as ReturnType<typeof authClient.useSession>);

      const { useItemMutations } = await getHookExports();
      const { deleteItem } = useItemMutations();

      await expect(deleteItem(itemId("item-1"))).rejects.toThrow(
        "Cannot mutate items without an authenticated user"
      );
    });
  });

  // Direct unit tests for the pure helper. Previously it was only exercised
  // transitively through collect-view, which meant the null-fallback path
  // and non-Error inputs had no coverage. The `satisfies` exhaustiveness
  // check protects compile time — these tests protect runtime.
  describe("getMutationErrorKey", () => {
    it("maps MaxTagsError to validation.tooManyTags", async () => {
      const { getMutationErrorKey, MaxTagsError } = await getHookExports();
      expect(getMutationErrorKey(new MaxTagsError())).toBe(
        "validation.tooManyTags"
      );
    });

    it("maps MaxTricksError to validation.tooManyTricks", async () => {
      const { getMutationErrorKey, MaxTricksError } = await getHookExports();
      expect(getMutationErrorKey(new MaxTricksError())).toBe(
        "validation.tooManyTricks"
      );
    });

    it("maps ItemNotFoundError to errors.itemMissing", async () => {
      const { getMutationErrorKey, ItemNotFoundError } = await getHookExports();
      expect(getMutationErrorKey(new ItemNotFoundError())).toBe(
        "errors.itemMissing"
      );
    });

    it("returns null for a generic Error", async () => {
      const { getMutationErrorKey } = await getHookExports();
      expect(getMutationErrorKey(new Error("boom"))).toBeNull();
    });

    it("returns null for non-Error values", async () => {
      const { getMutationErrorKey } = await getHookExports();
      expect(getMutationErrorKey(null)).toBeNull();
      expect(getMutationErrorKey(undefined)).toBeNull();
      expect(getMutationErrorKey("string error")).toBeNull();
      expect(getMutationErrorKey({ tag: "MAX_TAGS" })).toBeNull();
      expect(getMutationErrorKey(42)).toBeNull();
    });
  });
});
