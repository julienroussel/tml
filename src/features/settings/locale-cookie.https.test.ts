/**
 * The `secure` flag branch of `setLocaleCookie`, split into its own file so the
 * document can be served over HTTPS.
 *
 * `location.protocol` is a non-configurable own property of the jsdom
 * `Location` instance in every pool, so it cannot be spied or redefined; the
 * protocol has to come from the environment's URL. Do not merge this back into
 * `locale-cookie.test.ts`: a `vi.spyOn(globalThis, "location", …)` works only in
 * the `forks`/`threads` pools and throws `Cannot redefine property: location`
 * under `vmThreads`, which is the pool this suite runs on.
 *
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "https://localhost:3000/" }
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_MAX_AGE, setLocaleCookie } from "./locale-cookie";

vi.mock("@/i18n/config", () => ({
  isLocale: (value: string) =>
    ["en", "fr", "es", "pt", "it", "de", "nl"].includes(value),
}));

describe("setLocaleCookie over HTTPS", () => {
  let cookieSetter: (value: string) => void;

  beforeEach(() => {
    cookieSetter = vi.fn();
    vi.spyOn(document, "cookie", "set").mockImplementation(cookieSetter);
  });

  it("adds the secure flag", () => {
    setLocaleCookie("fr");

    expect(cookieSetter).toHaveBeenCalledWith(
      `NEXT_LOCALE=fr;path=/;max-age=${COOKIE_MAX_AGE};samesite=lax;secure`
    );
  });
});
