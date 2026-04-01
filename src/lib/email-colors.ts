/**
 * Hex color constants for email templates.
 *
 * Emails require inline hex values (no CSS variables, no oklch).
 * These values correspond to the light-mode `:root` tokens in
 * `src/app/globals.css`. The test suite validates they stay in sync
 * by parsing the CSS and comparing via culori at test time.
 *
 * CSS token              → oklch value           → hex
 * --primary              → oklch(0.205 0 0)      → #171717
 * --primary-foreground   → oklch(0.985 0 0)      → #fafafa
 * --foreground           → oklch(0.145 0 0)      → #0a0a0a
 * --muted-foreground     → oklch(0.556 0 0)      → #737373
 * --background           → oklch(1 0 0)          → #ffffff
 * --muted                → oklch(0.97 0 0)       → #f5f5f5
 */

/** Button background — matches `--primary` */
export const primaryHex = "#171717";

/** Button text — matches `--primary-foreground` */
export const primaryForegroundHex = "#fafafa";

/** Heading & body text — matches `--foreground` */
export const foregroundHex = "#0a0a0a";

/** Footer & secondary text — matches `--muted-foreground` */
export const mutedForegroundHex = "#737373";

/** Container / card background — matches `--background` */
export const backgroundHex = "#ffffff";

/** Outer email background — matches `--muted` */
export const mutedHex = "#f5f5f5";
