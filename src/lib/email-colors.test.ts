import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  backgroundHex,
  foregroundHex,
  mutedForegroundHex,
  mutedHex,
  primaryForegroundHex,
  primaryHex,
} = await import("./email-colors");

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;
const NEAR_BLACK_PATTERN = /^#[0-2]/;

const colors: Record<string, string> = {
  primaryHex,
  primaryForegroundHex,
  foregroundHex,
  mutedForegroundHex,
  backgroundHex,
  mutedHex,
};

describe("email-colors", () => {
  for (const [name, value] of Object.entries(colors)) {
    it(`${name} is a valid 6-digit hex color`, () => {
      expect(value).toMatch(HEX_PATTERN);
    });
  }

  it("derives --background as white", () => {
    expect(backgroundHex).toBe("#ffffff");
  });

  it("derives --primary as a near-black color", () => {
    expect(primaryHex).not.toBe("#7c3aed");
    expect(primaryHex).toMatch(NEAR_BLACK_PATTERN);
  });
});
