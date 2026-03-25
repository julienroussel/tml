import { describe, expect, it } from "vitest";
import {
  BASE_DIRECTIVES,
  buildCsp,
  DEV_EXTENSIONS,
  directivesToString,
  mergeDirectives,
} from "./csp";

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

  it("includes unsafe-inline in script-src for ThemeProvider compatibility", () => {
    const csp = buildCsp({ isDev: false });
    expect(csp).toContain("'unsafe-inline'");
  });

  it("does not include nonce (root layout ThemeProvider cannot receive one)", () => {
    const csp = buildCsp({ isDev: false });
    expect(csp).not.toContain("nonce");
  });
});
