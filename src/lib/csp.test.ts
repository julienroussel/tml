import { describe, expect, it } from "vitest";
import {
  applyNonce,
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

describe("applyNonce", () => {
  it("adds nonce to script-src", () => {
    const result = applyNonce(BASE_DIRECTIVES, "abc123");
    expect(result["script-src"]).toContain("'nonce-abc123'");
  });

  it("preserves existing script-src values", () => {
    const result = applyNonce(BASE_DIRECTIVES, "abc123");
    expect(result["script-src"]).toContain("'self'");
    expect(result["script-src"]).toContain("'unsafe-inline'");
    expect(result["script-src"]).toContain("https://va.vercel-scripts.com");
  });

  it("does not mutate the input directives", () => {
    const original = [...BASE_DIRECTIVES["script-src"]];
    applyNonce(BASE_DIRECTIVES, "test");
    expect(BASE_DIRECTIVES["script-src"]).toEqual(original);
  });

  it("does not add nonce to style-src", () => {
    const result = applyNonce(BASE_DIRECTIVES, "abc123");
    expect(result["style-src"]).toEqual(BASE_DIRECTIVES["style-src"]);
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

  it("includes nonce in script-src when provided", () => {
    const csp = buildCsp({ isDev: false, nonce: "dGVzdA==" });
    expect(csp).toContain("'nonce-dGVzdA=='");
  });

  it("keeps unsafe-inline alongside nonce for CSP Level 1 fallback", () => {
    const csp = buildCsp({ isDev: false, nonce: "dGVzdA==" });
    expect(csp).toContain("'unsafe-inline'");
    expect(csp).toContain("'nonce-dGVzdA=='");
  });

  it("does not include nonce when omitted", () => {
    const csp = buildCsp({ isDev: false });
    expect(csp).not.toContain("nonce-");
  });

  it("does not add nonce to style-src", () => {
    const csp = buildCsp({ isDev: false, nonce: "dGVzdA==" });
    const styleSrc = csp.split("; ").find((d) => d.startsWith("style-src"));
    expect(styleSrc).toBeDefined();
    expect(styleSrc).not.toContain("nonce");
  });
});
