# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

- **Tagline**: Train. Plan. Perform. Elevate your magic.
- **Description**: A personal workspace built for magicians — whether you're just starting out or performing professionally. A single place to organize your repertoire, plan your routines, track your practice sessions, and refine your performance over time.
- **Core features**: Practice logging, goal setting & drills, set/routine planning, performance tracking, continuous improvement tools, and inventory management (props, books, gimmicks, and other items).
- **Production URL**: https://themagiclab.app/
- **Hosting**: Vercel

## Commands

```bash
pnpm dev            # Start dev server
pnpm build          # Production build
pnpm start          # Start production server
pnpm lint           # Lint and format check (Ultracite)
pnpm fix            # Auto-fix lint and format issues (Ultracite)
pnpm test           # Run tests in watch mode (Vitest)
pnpm test:run       # Run tests once
pnpm test:coverage  # Run tests with coverage
pnpm test:ui        # Open Vitest UI
```

Requires Node 24.x and pnpm >= 10.

## Architecture

- **Next.js 16** with App Router (`src/app/`)
- **React 19** with React Compiler enabled for automatic memoization
- **Tailwind CSS v4** via PostCSS plugin — utility-first styling with dark mode (`dark:` prefix) and CSS custom properties for theming in `globals.css`
- **shadcn/ui** (new-york style) — component primitives built on Radix UI, styled with CVA + tailwind-merge + clsx via the `cn()` utility (`src/lib/utils.ts`)
- **Vercel Analytics** (`@vercel/analytics`) for page-view tracking
- **Vercel Speed Insights** (`@vercel/speed-insights`) for performance monitoring
- **PWA support** — web app manifest (`src/app/manifest.ts`), service worker (`public/sw.js`), push notifications (`web-push`)
- **next-themes** for dark mode toggling via `ThemeProvider`
- **Lucide React** for icons
- **tw-animate-css** for animations
- **Geist** font family (sans + mono)
- **TypeScript** in strict mode — path alias `@/*` → `src/*`
- Licensed under GPL-3.0

## TypeScript Standards

Type safety is a first-class concern in this project. All code must be rigorously typed.

- **Never use `any`**. Use `unknown` when the type is genuinely unknown, then narrow it explicitly.
- **No loose or weak typings**. Avoid `object`, `{}`, `Function`, or other overly broad types. Be specific.
- **Explicit return types** on exported functions and public APIs. Inferred types are acceptable for local/private helpers only when unambiguous.
- **Use modern type-level TypeScript**:
  - Discriminated unions over optional fields for modeling variants.
  - `satisfies` for validation without widening.
  - `as const` for literal types and immutable data.
  - Template literal types, mapped types, and conditional types where they improve safety.
  - Branded/opaque types for domain identifiers (e.g. `UserId`, `TrickId`) to prevent accidental mixing.
- **Prefer `interface` for object shapes** that may be extended; use `type` for unions, intersections, and computed types.
- **Generic constraints** (`T extends ...`) should be as narrow as possible.
- **No type assertions** (`as X`) unless absolutely unavoidable — prefer type guards and narrowing instead.
- **No `@ts-ignore` or `@ts-expect-error`** without an accompanying explanation and a tracking issue.
- **Exhaustive switch/if checks** — use `never` to catch unhandled cases at compile time.

## Tooling

- **Biome** for linting and formatting — 2-space indent, auto-organize imports
- **Ultracite** — zero-config code quality preset extending Biome (`biome.json` extends `ultracite/biome/core` and `ultracite/biome/next`)
- **Vitest** for testing
- **Lefthook** for git hooks — pre-commit runs `ultracite fix` on staged files
