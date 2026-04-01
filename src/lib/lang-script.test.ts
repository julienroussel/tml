import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LANG_SCRIPT } from "./lang-script";

/** Clear all jsdom cookies by expiring them. */
function clearCookies(): void {
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0]?.trim();
    // biome-ignore lint/suspicious/noDocumentCookie: testing requires direct cookie manipulation
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  }
}

/**
 * Runs the lang-detection script in jsdom with a controlled URL and cookies.
 * Each cookie must be set via a separate assignment (browser API constraint).
 */
function runScript(pathname: string, cookies: string[] = []): string {
  document.documentElement.lang = "en";
  Object.defineProperty(window, "location", {
    value: { pathname },
    writable: true,
    configurable: true,
  });
  clearCookies();
  for (const cookie of cookies) {
    // biome-ignore lint/suspicious/noDocumentCookie: testing requires direct cookie manipulation
    document.cookie = cookie;
  }

  // biome-ignore lint/security/noGlobalEval: intentional — testing the inline script string
  eval(LANG_SCRIPT);
  return document.documentElement.lang;
}

describe("LANG_SCRIPT", () => {
  beforeEach(() => {
    document.documentElement.lang = "en";
  });

  afterEach(() => {
    clearCookies();
  });

  describe("marketing URL detection", () => {
    it("sets lang from a root locale path", () => {
      expect(runScript("/fr")).toBe("fr");
    });

    it("sets lang from a locale path with subpage", () => {
      expect(runScript("/es/faq")).toBe("es");
    });

    it("handles all supported locales", () => {
      for (const locale of ["en", "fr", "es", "pt", "it", "de", "nl"]) {
        expect(runScript(`/${locale}`)).toBe(locale);
      }
    });

    it("ignores an invalid two-letter path segment", () => {
      expect(runScript("/xx")).toBe("en");
    });

    it("ignores a path segment longer than two letters", () => {
      expect(runScript("/french")).toBe("en");
    });
  });

  describe("NEXT_LOCALE cookie detection", () => {
    it("sets lang from cookie on non-marketing paths", () => {
      expect(runScript("/dashboard", ["NEXT_LOCALE=fr"])).toBe("fr");
    });

    it("ignores an invalid cookie locale", () => {
      expect(runScript("/dashboard", ["NEXT_LOCALE=xx"])).toBe("en");
    });

    it("reads cookie among other cookies", () => {
      expect(
        runScript("/dashboard", ["theme=dark", "NEXT_LOCALE=de", "other=value"])
      ).toBe("de");
    });
  });

  describe("precedence and fallback", () => {
    it("URL locale takes precedence over cookie", () => {
      expect(runScript("/de", ["NEXT_LOCALE=fr"])).toBe("de");
    });

    it("keeps lang='en' when no locale signal exists", () => {
      expect(runScript("/dashboard")).toBe("en");
    });

    it("keeps lang='en' for the root path with no cookie", () => {
      expect(runScript("/")).toBe("en");
    });
  });
});
