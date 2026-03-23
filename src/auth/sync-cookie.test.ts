import { describe, expect, it } from "vitest";
import { buildSyncCookieValue, parseSyncCookie } from "./sync-cookie";

const TEST_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

describe("buildSyncCookieValue", () => {
  it("joins userId, locale, and theme with pipe delimiter", () => {
    expect(buildSyncCookieValue(TEST_UUID, "en", "dark")).toBe(
      `${TEST_UUID}|en|dark`
    );
  });

  it("handles different locale and theme values", () => {
    expect(buildSyncCookieValue(TEST_UUID, "fr", "system")).toBe(
      `${TEST_UUID}|fr|system`
    );
  });
});

describe("parseSyncCookie", () => {
  it("parses a valid cookie value", () => {
    expect(parseSyncCookie(`${TEST_UUID}|en|dark`)).toEqual({
      userId: TEST_UUID,
      locale: "en",
      theme: "dark",
    });
  });

  it("parses all valid locales", () => {
    for (const locale of ["en", "fr", "es", "pt", "it", "de", "nl"]) {
      const result = parseSyncCookie(`${TEST_UUID}|${locale}|system`);
      expect(result).toEqual({
        userId: TEST_UUID,
        locale,
        theme: "system",
      });
    }
  });

  it("parses all valid themes", () => {
    for (const theme of ["light", "dark", "system"]) {
      const result = parseSyncCookie(`${TEST_UUID}|en|${theme}`);
      expect(result).toEqual({
        userId: TEST_UUID,
        locale: "en",
        theme,
      });
    }
  });

  it("returns null for empty string", () => {
    expect(parseSyncCookie("")).toBeNull();
  });

  it("returns null for too few parts", () => {
    expect(parseSyncCookie(`${TEST_UUID}|en`)).toBeNull();
  });

  it("returns null for too many parts", () => {
    expect(parseSyncCookie(`${TEST_UUID}|en|dark|extra`)).toBeNull();
  });

  it("returns null for invalid locale", () => {
    expect(parseSyncCookie(`${TEST_UUID}|xx|dark`)).toBeNull();
  });

  it("returns null for invalid theme", () => {
    expect(parseSyncCookie(`${TEST_UUID}|en|neon`)).toBeNull();
  });

  it("returns null when userId is empty", () => {
    expect(parseSyncCookie("|en|dark")).toBeNull();
  });

  it("returns null when userId is not a valid UUID", () => {
    expect(parseSyncCookie("not-a-uuid|en|dark")).toBeNull();
  });

  it("accepts uppercase UUID", () => {
    const upper = TEST_UUID.toUpperCase();
    expect(parseSyncCookie(`${upper}|en|dark`)).toEqual({
      userId: upper,
      locale: "en",
      theme: "dark",
    });
  });
});
