"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps, ReactElement } from "react";

/**
 * ThemeProvider props used in the root layout.
 * Shared with CSP hash verification tests and the hash computation script.
 */
export const THEME_PROVIDER_PROPS = {
  attribute: "class",
  defaultTheme: "system",
  enableSystem: true,
} as const;

export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>): ReactElement {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
