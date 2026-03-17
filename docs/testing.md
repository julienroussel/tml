# Testing Strategy

The Magic Lab uses Vitest for testing with a focus on high-value, maintainable tests.

## Test Framework

- **Runner**: Vitest 4.x
- **Environment**: jsdom (for DOM/React testing)
- **React testing**: @testing-library/react + @testing-library/user-event
- **Assertions**: Vitest built-in + @testing-library/jest-dom matchers
- **Coverage**: V8 provider with 80% threshold

## Configuration

Test configuration lives in `vitest.config.mts`:

- Path aliases via `vite-tsconfig-paths` (matches `@/*` from tsconfig)
- React plugin via `@vitejs/plugin-react`
- Setup file: `vitest.setup.ts` (jest-dom matchers, global mocks)
- Coverage thresholds: 80% statements, branches, functions, lines

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

### Test Factories (Planned)

```typescript
// src/test/factories.ts
function createTrick(overrides?: Partial<Trick>): Trick {
  return {
    id: crypto.randomUUID() as TrickId,
    name: "Ambitious Card",
    category: "card",
    difficulty: 3,
    ...overrides,
  };
}
```

### Mock Providers (Planned)

```typescript
// src/test/render.tsx
function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, {
    wrapper: ({ children }) => (
      <ThemeProvider>
        <PowerSyncProvider>{children}</PowerSyncProvider>
      </ThemeProvider>
    ),
    ...options,
  });
}
```

### Common Mocks (Planned)

- `next/navigation` (useRouter, usePathname, useSearchParams)
- `next/image` (renders as plain img)
- PowerSync hooks (useQuery, useStatus)
- Better Auth hooks (useSession)

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
- FAQ page renders at `/faq`
- Privacy page renders at `/privacy`
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
