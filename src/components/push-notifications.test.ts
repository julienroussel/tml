import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({}),
  },
}));

import { urlBase64ToUint8Array } from "./push-notifications";

describe("urlBase64ToUint8Array", () => {
  it("converts a standard base64url string", () => {
    // "SGVsbG8" is base64url for "Hello"
    const result = urlBase64ToUint8Array("SGVsbG8");
    expect(result).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(result)).toBe("Hello");
  });

  it("handles base64url character replacement (- to +, _ to /)", () => {
    // "a-b_c" should become "a+b/c" in standard base64
    const result = urlBase64ToUint8Array("a-b_cw");
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it("adds correct padding for strings needing 1 pad char", () => {
    // 3 chars needs 1 "=" padding (3 % 4 = 3, so (4-3)%4 = 1)
    const result = urlBase64ToUint8Array("YWI");
    expect(new TextDecoder().decode(result)).toBe("ab");
  });

  it("adds correct padding for strings needing 2 pad chars", () => {
    // 2 chars needs 2 "=" padding (2 % 4 = 2, so (4-2)%4 = 2)
    const result = urlBase64ToUint8Array("YQ");
    expect(new TextDecoder().decode(result)).toBe("a");
  });

  it("handles strings that need no padding", () => {
    // 4 chars needs 0 padding (4 % 4 = 0, so (4-0)%4 = 0)
    const result = urlBase64ToUint8Array("YWJj");
    expect(new TextDecoder().decode(result)).toBe("abc");
  });

  it("handles empty string", () => {
    const result = urlBase64ToUint8Array("");
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(0);
  });
});
