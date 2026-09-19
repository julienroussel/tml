import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// next-intl test mock — `t` returns "namespace.key" so tests catch
// wrong-namespace usage; interpolated values are appended in parentheses.
//
// The per-namespace `t` is MEMOIZED (issue #290) so useTranslations("collect")
// returns a referentially-stable `t` across rerenders. Effects that depend on
// `t` (the relations-error toast in collect-view / repertoire-view) must not
// refire on a no-op rerender — the idempotency tests assert that with strict
// equality, and a fresh-`t`-per-call mock silently breaks them. The caches are
// cleared after every test (below) to avoid cross-test reference bleed.
const { tClientCache, tServerCache, getClientT, getServerT } = vi.hoisted(
  () => {
    const makeT = (namespace?: string) => {
      const t = (key: string, values?: Record<string, string | number>) => {
        const fullKey = namespace ? `${namespace}.${key}` : key;
        if (values) {
          const parts = Object.entries(values).map(
            ([k, v]) => `${k}: ${String(v)}`
          );
          return `${fullKey} (${parts.join(", ")})`;
        }
        return fullKey;
      };
      return Object.assign(t, { rich: t, raw: t, markup: t });
    };

    type CachedTranslator = ReturnType<typeof makeT>;
    const clientCache = new Map<string, CachedTranslator>();
    const serverCache = new Map<string, CachedTranslator>();

    const cached = (
      cache: Map<string, CachedTranslator>,
      namespace?: string
    ): CachedTranslator => {
      const key = namespace ?? "";
      const existing = cache.get(key);
      if (existing) {
        return existing;
      }
      const created = makeT(namespace);
      cache.set(key, created);
      return created;
    };

    return {
      tClientCache: clientCache,
      tServerCache: serverCache,
      getClientT: (namespace?: string) => cached(clientCache, namespace),
      getServerT: (namespace?: string) => cached(serverCache, namespace),
    };
  }
);

// jsdom 30.1.0 sets the last-focused element to the *document* when the focused
// element is removed (Node-impl.js `_removingSteps`); 30.0.1 set it to null. The
// next focus() then fires a `blur` at `window`, which Radix menus treat as
// "window lost focus" and close on. So the first test that unmounts an open menu
// breaks every later test in the file. Focusing and blurring a throwaway element
// after cleanup returns jsdom's focus state to null.
function resetJsdomFocus(): void {
  const probe = document.createElement("button");
  document.body.append(probe);
  probe.focus();
  probe.blur();
  probe.remove();
}

afterEach(() => {
  cleanup();
  resetJsdomFocus();
});

// Drop memoized translators so each test starts with fresh `t` references.
afterEach(() => {
  tClientCache.clear();
  tServerCache.clear();
});

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => getClientT(namespace),
  useLocale: () => "en",
  useMessages: () => ({}),
  NextIntlClientProvider: ({ children }: { children: unknown }) => children,
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: (
    namespaceOrOpts?: string | { locale?: string; namespace?: string }
  ) => {
    const namespace =
      typeof namespaceOrOpts === "string"
        ? namespaceOrOpts
        : namespaceOrOpts?.namespace;
    return Promise.resolve(getServerT(namespace));
  },
  getLocale: () => Promise.resolve("en"),
  getMessages: () => Promise.resolve({}),
}));
