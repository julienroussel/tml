import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // Excluded: layout/provider wrappers and root-level error boundaries
      // that are difficult to unit test in isolation (they compose other
      // components or rely on framework internals with their own tests)
      exclude: [
        "src/**/*.test.*",
        "src/**/*.d.ts",
        "src/app/layout.tsx",
        "src/app/(app)/layout.tsx",
        "src/app/(app)/*/page.tsx",
        "src/app/global-error.tsx",
        "src/components/theme-provider.tsx",
        "src/components/app-sidebar.tsx",
        // shadcn vendor components and hooks — tested upstream
        "src/components/ui/badge.tsx",
        "src/components/ui/card.tsx",
        "src/components/ui/input.tsx",
        "src/components/ui/separator.tsx",
        "src/components/ui/sheet.tsx",
        "src/components/ui/sidebar.tsx",
        "src/components/ui/skeleton.tsx",
        "src/components/ui/tooltip.tsx",
        "src/hooks/use-mobile.ts",
        // Lazy-loading wrapper that just re-exports via React.lazy; no logic to cover
        "src/components/push-notifications-lazy.tsx",
      ],
      reporter: process.env.CI ? ["text", "lcov"] : ["text", "html", "lcov"],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
