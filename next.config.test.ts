import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("next.config headers", () => {
  const getGlobalHeaders = async () => {
    const headerGroups = await nextConfig.headers?.();
    const global = headerGroups?.find((g) => g.source === "/(.*)");
    if (!global) {
      throw new Error("Global headers group not found");
    }
    return global.headers;
  };

  const getHeaderValue = async (key: string) => {
    const headers = await getGlobalHeaders();
    return headers.find((h) => h.key === key)?.value;
  };

  it("sets X-Content-Type-Options to nosniff", async () => {
    expect(await getHeaderValue("X-Content-Type-Options")).toBe("nosniff");
  });

  it("sets X-Frame-Options to DENY", async () => {
    expect(await getHeaderValue("X-Frame-Options")).toBe("DENY");
  });

  it("sets Referrer-Policy", async () => {
    expect(await getHeaderValue("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin"
    );
  });

  it("sets Permissions-Policy to restrict sensitive APIs", async () => {
    const value = await getHeaderValue("Permissions-Policy");
    expect(value).toContain("camera=()");
    expect(value).toContain("microphone=()");
    expect(value).toContain("geolocation=()");
  });

  it("sets HSTS with includeSubDomains and preload", async () => {
    const value = await getHeaderValue("Strict-Transport-Security");
    expect(value).toContain("max-age=63072000");
    expect(value).toContain("includeSubDomains");
    expect(value).toContain("preload");
  });

  it("does not set static Content-Security-Policy (CSP is dynamic per-request in proxy.ts)", async () => {
    const csp = await getHeaderValue("Content-Security-Policy");
    expect(csp).toBeUndefined();
  });

  it("does not include deprecated X-XSS-Protection header", async () => {
    expect(await getHeaderValue("X-XSS-Protection")).toBeUndefined();
  });

  it("disables poweredByHeader", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
