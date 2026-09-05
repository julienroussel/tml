# Testing Strategy

The Magic Lab uses Vitest for testing with a focus on high-value, maintainable tests.

## Test Framework

- **Runner**: Vitest 5.x
- **Environment**: jsdom (for DOM/React testing)
- **React testing**: @testing-library/react + @testing-library/user-event
- **Assertions**: Vitest built-in + @testing-library/jest-dom matchers
- **Coverage**: V8 provider with 80% threshold

## Configuration

Test configuration lives in `vitest.config.mts`:

- Path aliases via Vite's native `resolve.tsconfigPaths` (matches `@/*` from tsconfig)
- React plugin via `@vitejs/plugin-react`
- Setup file: `vitest.setup.ts` (jest-dom matchers, global mocks)
- Coverage thresholds: 80% statements, branches, functions, lines
- Pool: `vmThreads`, with per-file isolation preserved (see below)

## Pool and Isolation

Creating a jsdom environment costs roughly 200-500ms, and under the default
`forks` pool that happens once per test file. With 143 files it dominates the
run, so the pool choice is the single biggest lever on wall-clock time.

The suite runs on **`pool: 'vmThreads'`**: jsdom is built once per worker, and
each test file still gets a fresh VM context and window. Isolation is preserved
(files do not share a module registry, a `document`, or mock state), so this is
a pure startup saving, not a trade against test independence.

Wall-clock figures are from `pnpm exec vitest doctor` on a dev Mac. They are
indicative, not a CI benchmark; re-run it locally rather than trusting the
absolute numbers.

| Configuration | Result |
|---|---|
| `pool: 'forks'` (Vitest default) | 20.13s |
| `pool: 'threads'` | 16.34s |
| **`pool: 'vmThreads'` (current)** | **4.22s** |
| `pool: 'vmForks'` | 5.17s |
| `isolate: false` | fails and hangs (see below) |
| `fsModuleCache: true` | 3.93s (-7%), not enabled (see below) |

Two things to know before changing this:

- **Memory reclamation is less reliable in the vm pools** than with forked
  workers, which get a fresh process heap each. This has not been validated on
  CI hardware (`ubuntu-latest`, 4 vCPU), and CI's only test step is
  `pnpm test:coverage`. If it ever OOMs there, `pool: 'threads'` is the fallback
  and the suite passes under it unchanged.
- **Do not pin `maxWorkers`.** Capping it measured slower than the default in
  every run, and the default already scales to the host's core count.

`fsModuleCache: true` persists transformed modules to disk between runs. It
measured -7%, below the threshold worth taking, and Vitest documents its
invalidation tracking as incomplete (plugins reading files outside the tracked
config can serve stale output). Not worth a class of cache-staleness bug for
0.3s.

### Test code that depends on the pool

Three files were adapted to run under a VM context. Do not revert these without
re-reading this section. Each one passes under `forks`/`threads` either way, so
the breakage only shows up when the pool changes.

- `src/lib/lang-script.test.ts` navigates with `history.replaceState` instead of
  redefining `window.location`. `location` carries WebIDL's `[Unforgeable]`
  flag, so it is non-configurable whenever the real jsdom window is the global,
  as it is in the vm pools. (Under `forks`/`threads` Vitest copies jsdom globals
  onto Node's `globalThis` as ordinary configurable properties, which is why
  redefining it happened to work.) `LANG_SCRIPT` reads only `location.pathname`,
  so it now sees a real `Location` rather than a `{ pathname }` stub.
- `src/features/settings/locale-cookie.https.test.ts` exists because
  `location.protocol` is a non-configurable own property of the jsdom `Location`
  in *every* pool, so the `secure`-flag branch has to get HTTPS from the
  environment's URL via a `@vitest-environment-options` docblock. The plain-HTTP
  branch stays in `locale-cookie.test.ts` and needs no stub at all, since jsdom
  serves `http://localhost:3000/` by default.
- `src/sync/provider.test.tsx` matches a thrown `SyntaxError` by `name` rather
  than `expect.any(SyntaxError)`. An error thrown inside the VM comes from a
  different realm, so it is not `instanceof` the constructor in the test's
  scope. This is the documented cross-realm caveat of the vm pools.

### Why `isolate: false` is not an option

Sharing one environment across files is faster still, but this suite does not
tolerate it. Failures are order-dependent and diffuse rather than traceable to a
few files: across five runs the set varied (2, 3 and 8 failures, plus two hangs
that never terminated). The dominant cause is a shared module registry:
`src/auth/session-user.test.ts` passes alone and passes alongside all seven
other files that mock `@/auth/client`, but fails in a full run, receiving the
mock factory's default instead of its own per-test override.

Two concrete leaks are confirmed and worth fixing on their own merits, even
though the current pool hides them:

- `settings-restorer.test.tsx` and `locale-selector.test.tsx` call
  `Object.defineProperty(document, "cookie", { writable: true, value })` without
  `configurable: true`, so the property becomes permanently non-configurable and
  any later `vi.spyOn(document, "cookie", …)` throws. The `afterEach` guard meant
  to restore it is dead code: `document.cookie` lives on `Document.prototype`,
  so the module-level `Object.getOwnPropertyDescriptor(document, "cookie")` is
  `undefined` and the restore never runs.
- `src/auth/session-user.test.ts` ("gives up waiting when the pending fetch never
  settles") leaves a never-settling promise that hangs a shared worker.

## Co-Located Test Files

Tests are co-located with their source files using the `.test.ts` / `.test.tsx` suffix:

```
src/
  lib/
    utils.ts
    utils.test.ts
  components/
    theme-toggle.tsx
    theme-toggle.test.tsx
  app/
    page.tsx
    page.test.tsx
```

This pattern keeps tests close to implementation, making it easy to find and update tests when code changes.

## Coverage Thresholds

### Global Threshold

All metrics (statements, branches, functions, lines) must meet 80%.

### Per-Tier Targets

| Tier | Target | What |
|---|---|---|
| Domain logic | 95% | Pure functions, utilities, data transformations |
| Server actions | 85% | API routes, server actions, data fetching |
| Components | 70% | React components, hooks, UI interactions |

### Excluded from Coverage

The following are excluded from coverage metrics (configured in `vitest.config.mts`):

- **Layout wrappers**: `src/app/layout.tsx`, `src/app/(app)/layout.tsx` -- compose other components, tested via integration
- **Module pages**: `src/app/(app)/*/page.tsx` -- thin wrappers, mostly layout
- **Global error boundary**: `src/app/global-error.tsx` -- framework-level error handling
- **Theme provider**: `src/components/theme-provider.tsx` -- wraps next-themes
- **shadcn vendor components**: `src/components/ui/*.tsx` (badge, card, input, etc.) -- tested upstream
- **shadcn hooks**: `src/hooks/use-mobile.ts` -- tested upstream
- **Lazy wrappers**: `src/components/push-notifications-lazy.tsx` -- just `React.lazy()`

## Test Utilities

### Test Factories

`src/test/factories.ts` provides `createTestUser()`, `createTestTrick()`, `createTestSetlist()`, `createTestTag()`, `createTestTrickTag()`, `createTestPracticeSession()`, `createTestPerformance()`, `createTestItem()`, `createTestGoal()`, and more. Each returns a fully-typed entity with sensible defaults and deterministic IDs.

### Mock Providers

`src/test/render.tsx` exports a custom `renderWithProviders()` wrapper that includes `NextIntlClientProvider` (locale `"en"`, UTC timezone). ThemeProvider and PowerSync are omitted by default — add them per-test when needed.

### Common Mocks

`src/test/mocks.tsx` activates mocks for:

- `next/navigation` (useRouter, usePathname, useSearchParams, useParams, redirect, notFound)
- `next/image` (renders as plain `<img>`)
- `next/link` (renders as plain `<a>`)

Importing the file activates all mocks via hoisted `vi.mock()` calls.

## Test Patterns

### Testing Pure Functions

```typescript
import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });
});
```

### Testing Components

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  it("renders a toggle button", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button")).toBeDefined();
  });
});
```

### Testing Async / Server Actions

```typescript
import { describe, expect, it, vi } from "vitest";

describe("subscribeUser", () => {
  it("stores the push subscription", async () => {
    const result = await subscribeUser(mockSubscription);
    expect(result.success).toBe(true);
  });
});
```

## What NOT to Test

- **shadcn/ui primitives**: Tested upstream by Radix UI
- **Next.js framework behavior**: Routing, middleware, SSR hydration
- **Third-party library internals**: Tailwind class generation, theme toggling
- **Pure layout composition**: Components that only arrange children
- **CSS / visual styling**: Use visual regression testing tools instead
- **Implementation details**: Internal state, private methods, render counts

## Running Tests

```bash
pnpm test              # Watch mode
pnpm test:run          # Single run
pnpm test:coverage     # With coverage report
pnpm test:ui           # Vitest UI browser interface
```

## CI Integration

Tests run on every pull request via GitHub Actions:

- `pnpm test:run` -- all tests must pass
- `pnpm test:coverage` -- coverage thresholds enforced
- Coverage report uploaded as LCOV for PR annotations

## E2E Testing

End-to-end smoke tests use Playwright to validate the app boots and critical pages render correctly.

- **Framework**: Playwright (Chromium only)
- **Test directory**: `e2e/` (separate from unit tests)
- **Config**: `playwright.config.ts`
- **Dev server**: Playwright starts `pnpm dev` automatically via `webServer` config

### What Smoke Tests Cover

- Landing page loads with tagline and `<main id="main-content">`
- FAQ page renders at `/[locale]/faq` (e.g., `/en/faq`)
- Privacy page renders at `/[locale]/privacy` (e.g., `/en/privacy`)
- Unauthenticated `/dashboard` access redirects to `/auth/sign-in`
- Auth sign-in page renders

### Running E2E Tests

```bash
pnpm test:e2e       # Run all E2E tests (headless)
pnpm test:e2e:ui    # Open Playwright UI mode for debugging
```

### CI Integration

E2E tests run as a separate GitHub Actions job after the main CI job passes. The job uses `continue-on-error: true` while stability is validated. Playwright browsers are cached, and test reports are uploaded as artifacts.

### Prerequisites

Install Playwright browsers before first run:

```bash
pnpm exec playwright install --with-deps chromium
```

The dev server requires `NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET` environment variables (or a `.env` file) to start.

## See Also

- [architecture.md](./architecture.md) -- Overall architecture
- [local-development.md](./local-development.md) -- Dev environment setup
