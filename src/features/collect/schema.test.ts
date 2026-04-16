import { describe, expect, it } from "vitest";
import { ITEM_CONDITIONS, ITEM_TYPES } from "./constants";
import { itemFormSchema } from "./schema";

describe("itemFormSchema", () => {
  describe("name field", () => {
    it("is valid with only name and type provided", () => {
      const result = itemFormSchema.safeParse({
        name: "Svengali Deck",
        type: "deck",
      });
      expect(result.success).toBe(true);
    });

    it("is valid with all fields provided", () => {
      const result = itemFormSchema.safeParse({
        name: "Invisible Deck",
        type: "deck",
        description: "A classic effect",
        brand: "Bicycle",
        creator: "Bob Ostin",
        condition: "new",
        location: "Close-up case",
        quantity: 2,
        purchaseDate: "2025-01-15",
        purchasePrice: "29.99",
        url: "https://vanishinginc.com/invisible-deck",
        notes: "Great for walk-around",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const result = itemFormSchema.safeParse({ name: "", type: "prop" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("validation.nameRequired");
      }
    });

    it("rejects whitespace-only name after trim", () => {
      const result = itemFormSchema.safeParse({ name: "   ", type: "prop" });
      expect(result.success).toBe(false);
    });

    it("rejects name exceeding 200 characters", () => {
      const result = itemFormSchema.safeParse({
        name: "a".repeat(201),
        type: "prop",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("validation.nameTooLong");
      }
    });

    it("accepts name of exactly 200 characters", () => {
      const result = itemFormSchema.safeParse({
        name: "a".repeat(200),
        type: "prop",
      });
      expect(result.success).toBe(true);
    });

    it("trims whitespace from name", () => {
      const result = itemFormSchema.safeParse({
        name: "  Svengali Deck  ",
        type: "deck",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Svengali Deck");
      }
    });
  });

  describe("type field", () => {
    it("accepts all valid ITEM_TYPES", () => {
      for (const type of ITEM_TYPES) {
        const result = itemFormSchema.safeParse({ name: "Item", type });
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid type", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "furniture",
      });
      expect(result.success).toBe(false);
    });

    it("requires type to be provided", () => {
      const result = itemFormSchema.safeParse({ name: "Item" });
      expect(result.success).toBe(false);
    });
  });

  describe("condition field", () => {
    it("accepts all valid ITEM_CONDITIONS", () => {
      for (const condition of ITEM_CONDITIONS) {
        const result = itemFormSchema.safeParse({
          name: "Item",
          type: "prop",
          condition,
        });
        expect(result.success).toBe(true);
      }
    });

    it("accepts null condition", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        condition: null,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.condition).toBeNull();
      }
    });

    it("defaults to null when not provided", () => {
      const result = itemFormSchema.safeParse({ name: "Item", type: "prop" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.condition).toBeNull();
      }
    });

    it("rejects invalid condition value", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        condition: "perfect",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("quantity field", () => {
    it("accepts valid integer quantity", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        quantity: 5,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.quantity).toBe(5);
      }
    });

    it("accepts quantity of 0", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        quantity: 0,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.quantity).toBe(0);
      }
    });

    it("accepts quantity of 9999", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        quantity: 9999,
      });
      expect(result.success).toBe(true);
    });

    it("rejects quantity of 10000", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        quantity: 10_000,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("validation.quantityMax");
      }
    });

    it("rejects negative quantity", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        quantity: -1,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("validation.quantityMin");
      }
    });

    it("rejects non-integer quantity", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        quantity: 1.5,
      });
      expect(result.success).toBe(false);
    });

    it("coerces string quantity to number", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        quantity: "3",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.quantity).toBe(3);
      }
    });

    it("defaults to 1 when not provided", () => {
      const result = itemFormSchema.safeParse({ name: "Item", type: "prop" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.quantity).toBe(1);
      }
    });
  });

  describe("purchasePrice field", () => {
    it("accepts valid decimal price", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        purchasePrice: "29.99",
      });
      expect(result.success).toBe(true);
    });

    it("accepts integer price without decimals", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        purchasePrice: "30",
      });
      expect(result.success).toBe(true);
    });

    it("accepts price with one decimal place", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        purchasePrice: "9.5",
      });
      expect(result.success).toBe(true);
    });

    it("accepts price of 0", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        purchasePrice: "0",
      });
      expect(result.success).toBe(true);
    });

    it("accepts empty string", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        purchasePrice: "",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.purchasePrice).toBe("");
      }
    });

    it("defaults to empty string when not provided", () => {
      const result = itemFormSchema.safeParse({ name: "Item", type: "prop" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.purchasePrice).toBe("");
      }
    });

    it("rejects non-numeric string", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        purchasePrice: "abc",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("validation.invalidPrice");
      }
    });

    it("rejects price with more than 2 decimal places", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        purchasePrice: "9.999",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("validation.invalidPrice");
      }
    });

    it("rejects price with leading non-digit before decimal", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        purchasePrice: ".99",
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative price values", () => {
      for (const price of ["-10.00", "-0.01", "-1"]) {
        const result = itemFormSchema.safeParse({
          name: "Item",
          type: "prop",
          purchasePrice: price,
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toBe(
            "validation.invalidPrice"
          );
        }
      }
    });
  });

  describe("purchaseDate field", () => {
    it("accepts a valid ISO date string", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        purchaseDate: "2025-01-15",
      });
      expect(result.success).toBe(true);
    });

    it("accepts empty string", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        purchaseDate: "",
      });
      expect(result.success).toBe(true);
    });

    it("defaults to empty string when not provided", () => {
      const result = itemFormSchema.safeParse({ name: "Item", type: "prop" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.purchaseDate).toBe("");
      }
    });

    it("rejects invalid date string", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        purchaseDate: "not-a-date",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("validation.invalidDate");
      }
    });
  });

  describe("url field", () => {
    it("accepts a valid HTTPS URL", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        url: "https://vanishinginc.com/product",
      });
      expect(result.success).toBe(true);
    });

    it("accepts empty string", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        url: "",
      });
      expect(result.success).toBe(true);
    });

    it("defaults to empty string when not provided", () => {
      const result = itemFormSchema.safeParse({ name: "Item", type: "prop" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toBe("");
      }
    });

    it("rejects HTTP URL (non-HTTPS)", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        url: "http://example.com/product",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("validation.invalidUrl");
      }
    });

    it("rejects plain text that is not a URL", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        url: "not-a-url",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("validation.invalidUrl");
      }
    });

    it("rejects url exceeding 2000 characters", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        url: `https://example.com/${"a".repeat(2000)}`,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("validation.urlTooLong");
      }
    });

    it("normalizes uppercase HTTPS:// scheme to lowercase", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        url: "HTTPS://example.com/Path?q=Value",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toBe("https://example.com/Path?q=Value");
      }
    });

    it("normalizes mixed-case Https:// scheme to lowercase", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        url: "Https://example.com",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toBe("https://example.com");
      }
    });

    it("rejects javascript: scheme", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        url: "javascript:alert(1)",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("validation.invalidUrl");
      }
    });

    it("rejects data: scheme", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        url: "data:text/html,<h1>x</h1>",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("validation.invalidUrl");
      }
    });

    it("rejects bare https:// with no host", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        url: "https://",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("validation.invalidUrl");
      }
    });

    it("trims surrounding whitespace before validation", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        url: "  https://example.com  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toBe("https://example.com");
      }
    });
  });

  describe("string trim behavior", () => {
    it("trims description, brand, creator, location, notes", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        description: "  desc text  ",
        brand: "  Bicycle  ",
        creator: "  Creator  ",
        location: "  Storage  ",
        notes: "  notes  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe("desc text");
        expect(result.data.brand).toBe("Bicycle");
        expect(result.data.creator).toBe("Creator");
        expect(result.data.location).toBe("Storage");
        expect(result.data.notes).toBe("notes");
      }
    });
  });

  describe("description field", () => {
    it("accepts description at exactly 2000 characters", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        description: "a".repeat(2000),
      });
      expect(result.success).toBe(true);
    });

    it("rejects description at 2001 characters", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        description: "a".repeat(2001),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          "validation.descriptionTooLong"
        );
      }
    });

    it("defaults to empty string when not provided", () => {
      const result = itemFormSchema.safeParse({ name: "Item", type: "prop" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe("");
      }
    });
  });

  describe("notes field", () => {
    it("accepts notes at exactly 5000 characters", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        notes: "a".repeat(5000),
      });
      expect(result.success).toBe(true);
    });

    it("rejects notes at 5001 characters", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        notes: "a".repeat(5001),
      });
      expect(result.success).toBe(false);
    });

    it("defaults to empty string when not provided", () => {
      const result = itemFormSchema.safeParse({ name: "Item", type: "prop" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.notes).toBe("");
      }
    });
  });

  describe("brand field", () => {
    it("accepts brand at exactly 200 characters", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        brand: "a".repeat(200),
      });
      expect(result.success).toBe(true);
    });

    it("rejects brand at 201 characters", () => {
      const result = itemFormSchema.safeParse({
        name: "Item",
        type: "prop",
        brand: "a".repeat(201),
      });
      expect(result.success).toBe(false);
    });

    it("defaults to empty string when not provided", () => {
      const result = itemFormSchema.safeParse({ name: "Item", type: "prop" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.brand).toBe("");
      }
    });
  });

  describe("coerced defaults for all optional fields", () => {
    it("applies all default values when only name and type are given", () => {
      const result = itemFormSchema.safeParse({ name: "Item", type: "prop" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe("");
        expect(result.data.brand).toBe("");
        expect(result.data.creator).toBe("");
        expect(result.data.condition).toBeNull();
        expect(result.data.location).toBe("");
        expect(result.data.quantity).toBe(1);
        expect(result.data.purchaseDate).toBe("");
        expect(result.data.purchasePrice).toBe("");
        expect(result.data.url).toBe("");
        expect(result.data.notes).toBe("");
      }
    });
  });
});
