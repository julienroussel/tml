import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COOKIE_MAX_AGE,
  getLocaleCookie,
  setLocaleCookie,
} from "./locale-cookie";

vi.mock("@/i18n/config", () => ({
  isLocale: (value: string) =>
    ["en", "fr", "es", "pt", "it", "de", "nl"].includes(value),
}));

describe("getLocaleCookie", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns undefined when no cookie is set", () => {
    vi.spyOn(document, "cookie", "get").mockReturnValue("");
    expect(getLocaleCookie()).toBeUndefined();
  });

  it("returns the value when NEXT_LOCALE cookie exists", () => {
    vi.spyOn(document, "cookie", "get").mockReturnValue("NEXT_LOCALE=fr");
    expect(getLocaleCookie()).toBe("fr");
  });

  it("returns the correct value among multiple cookies", () => {
    vi.spyOn(document, "cookie", "get").mockReturnValue(
      "theme=dark; NEXT_LOCALE=de; other=value"
    );
    expect(getLocaleCookie()).toBe("de");
  });
});

describe("setLocaleCookie", () => {
  let cookieSetter: (value: string) => void;

  beforeEach(() => {
    cookieSetter = vi.fn();
    vi.spyOn(document, "cookie", "set").mockImplementation(cookieSetter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // jsdom's default document URL is http://localhost:3000/, so the plain-HTTP
  // branch needs no stubbing. The HTTPS branch lives in
  // `locale-cookie.https.test.ts` (see the note there).
  it("sets cookie with correct format", () => {
    setLocaleCookie("en");

    expect(cookieSetter).toHaveBeenCalledWith(
      `NEXT_LOCALE=en;path=/;max-age=${COOKIE_MAX_AGE};samesite=lax`
    );
  });

  it("is a no-op for invalid locale", () => {
    setLocaleCookie("xx");
    expect(cookieSetter).not.toHaveBeenCalled();
  });
});
