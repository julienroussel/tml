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
        "src/app/global-error.tsx",
        "src/components/theme-provider.tsx",
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
