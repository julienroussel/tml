import { createHash } from "node:crypto";
import { render } from "@testing-library/react";
// Imported directly from next-themes (not our wrapper @/components/theme-provider)
// because the test must verify the raw script output of ThemeProvider itself.
import { ThemeProvider } from "next-themes";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_PROVIDER_PROPS } from "@/components/theme-provider";
import { LANG_SCRIPT } from "@/lib/lang-script";
import {
  BASE_DIRECTIVES,
  buildCsp,
  DEV_EXTENSIONS,
  directivesToString,
  INLINE_SCRIPT_HASHES,
  LANG_SCRIPT_HASH,
  mergeDirectives,
  THEME_SCRIPT_HASH,
} from "./csp";

const CSP_SHA256_FORMAT = /^'sha256-[A-Za-z0-9+/=]+'$/;
const UPGRADE_INSECURE_WITH_TRAILING_SPACE = /upgrade-insecure-requests /;

function sha256Csp(content: string): string {
  const hash = createHash("sha256").update(content, "utf-8").digest("base64");
  return `'sha256-${hash}'`;
}

describe("BASE_DIRECTIVES", () => {
  it("includes self in default-src", () => {
    expect(BASE_DIRECTIVES["default-src"]).toContain("'self'");
  });

  it("includes Vercel analytics in connect-src", () => {
    expect(BASE_DIRECTIVES["connect-src"]).toContain(
      "https://va.vercel-scripts.com"
    );
    expect(BASE_DIRECTIVES["connect-src"]).toContain(
      "https://vitals.vercel-insights.com"
    );
  });

  it("includes PowerSync in connect-src (HTTPS and WSS)", () => {
    expect(BASE_DIRECTIVES["connect-src"]).toContain(
      "https://*.powersync.journeyapps.com"
    );
    expect(BASE_DIRECTIVES["connect-src"]).toContain(
      "wss://*.powersync.journeyapps.com"
    );
  });

  it("includes Neon Auth in connect-src pinned to region c-2", () => {
    expect(BASE_DIRECTIVES["connect-src"]).toContain(
      "https://*.neonauth.c-2.eu-central-1.aws.neon.tech"
    );
  });

  it("includes Neon Data API in connect-src pinned to region c-2", () => {
    expect(BASE_DIRECTIVES["connect-src"]).toContain(
      "https://*.apirest.c-2.eu-central-1.aws.neon.tech"
    );
  });

  it("includes Google profile avatars in img-src", () => {
    expect(BASE_DIRECTIVES["img-src"]).toContain(
      "https://lh3.googleusercontent.com"
    );
  });

  it("blocks object-src", () => {
    expect(BASE_DIRECTIVES["object-src"]).toEqual(["'none'"]);
  });

  it("blocks frame-ancestors", () => {
    expect(BASE_DIRECTIVES["frame-ancestors"]).toEqual(["'none'"]);
  });
});

describe("DEV_EXTENSIONS", () => {
  it("adds WebSocket source for HMR", () => {
    expect(DEV_EXTENSIONS["connect-src"]).toContain("wss://localhost:*");
  });

  it("adds Drizzle Studio frame source", () => {
    expect(DEV_EXTENSIONS["frame-src"]).toContain(
      "https://local.drizzle.studio"
    );
  });
});

describe("mergeDirectives", () => {
  it("merges extensions into base directives", () => {
    const result = mergeDirectives(BASE_DIRECTIVES, DEV_EXTENSIONS);

    expect(result["connect-src"]).toContain("'self'");
    expect(result["connect-src"]).toContain("wss://localhost:*");
  });

  it("does not mutate the base directives", () => {
    const originalLength = BASE_DIRECTIVES["connect-src"].length;
    mergeDirectives(BASE_DIRECTIVES, DEV_EXTENSIONS);
    expect(BASE_DIRECTIVES["connect-src"]).toHaveLength(originalLength);
  });

  it("preserves directives without extensions", () => {
    const result = mergeDirectives(BASE_DIRECTIVES, {
      "connect-src": ["https://example.com"],
    });
    expect(result["default-src"]).toEqual(BASE_DIRECTIVES["default-src"]);
    expect(result["script-src"]).toEqual(BASE_DIRECTIVES["script-src"]);
  });
});

describe("directivesToString", () => {
  it("joins directives with semicolons", () => {
    const result = directivesToString(BASE_DIRECTIVES);
    expect(result).toContain("default-src 'self'");
    expect(result).toContain("; ");
  });

  it("omits directives with empty arrays", () => {
    const result = directivesToString(BASE_DIRECTIVES);
    expect(result).not.toContain("frame-src");
  });

  it("emits boolean directives without values", () => {
    const result = directivesToString(BASE_DIRECTIVES);
    expect(result).toContain("upgrade-insecure-requests");
    expect(result).not.toMatch(UPGRADE_INSECURE_WITH_TRAILING_SPACE);
  });

  it("skips directives in the skip set", () => {
    const result = directivesToString(
      BASE_DIRECTIVES,
      new Set(["upgrade-insecure-requests"])
    );
    expect(result).not.toContain("upgrade-insecure-requests");
  });
});

describe("buildCsp", () => {
  it("returns production CSP without dev sources", () => {
    const csp = buildCsp({ isDev: false });
    expect(csp).not.toContain("ws://localhost");
    expect(csp).not.toContain("drizzle.studio");
  });

  it("returns dev CSP with HMR and Drizzle Studio sources", () => {
    const csp = buildCsp({ isDev: true });
    expect(csp).toContain("wss://localhost:*");
    expect(csp).toContain("https://local.drizzle.studio");
  });

  it("always includes core security directives", () => {
    for (const isDev of [true, false]) {
      const csp = buildCsp({ isDev });
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
    }
  });

  it("includes unsafe-inline in script-src for CSP Level 1 fallback", () => {
    const csp = buildCsp({ isDev: false });
    expect(csp).toContain("'unsafe-inline'");
  });

  it("includes inline script hashes in script-src", () => {
    const csp = buildCsp({ isDev: false });
    for (const hash of INLINE_SCRIPT_HASHES) {
      expect(csp).toContain(hash);
    }
  });

  it("includes upgrade-insecure-requests in production", () => {
    const csp = buildCsp({ isDev: false });
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("omits upgrade-insecure-requests in dev", () => {
    const csp = buildCsp({ isDev: true });
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});

describe("INLINE_SCRIPT_HASHES", () => {
  beforeEach(() => {
    // next-themes reads matchMedia during initialization.
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn().mockReturnValue(true),
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("contains exactly 2 hashes (LANG_SCRIPT + next-themes)", () => {
    expect(INLINE_SCRIPT_HASHES).toHaveLength(2);
  });

  it("all hashes use CSP sha256 format", () => {
    for (const hash of INLINE_SCRIPT_HASHES) {
      expect(hash).toMatch(CSP_SHA256_FORMAT);
    }
  });

  it("LANG_SCRIPT hash matches actual content (update with: pnpm hash:csp)", () => {
    expect(LANG_SCRIPT_HASH).toBe(sha256Csp(LANG_SCRIPT));
  });

  it("next-themes hash matches ThemeProvider script (update with: pnpm hash:csp)", () => {
    // Render with the shared THEME_PROVIDER_PROPS (used by layout.tsx and this test).
    const { container } = render(
      createElement(ThemeProvider, THEME_PROVIDER_PROPS, createElement("div"))
    );

    const script = container.querySelector("script");
    if (!script) {
      throw new Error("Expected ThemeProvider to inject a <script> element");
    }

    const scriptContent = script.innerHTML;
    expect(scriptContent.length).toBeGreaterThan(0);

    expect(
      THEME_SCRIPT_HASH,
      "next-themes hash mismatch — run: pnpm hash:csp"
    ).toBe(sha256Csp(scriptContent));
  });
});
