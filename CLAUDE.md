# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Lint and format check (Biome)
pnpm format       # Auto-format code (Biome)
pnpm test         # Run tests (Vitest)
pnpm check        # Check code quality (Ultracite)
pnpm fix          # Auto-fix code quality issues (Ultracite)
```

Requires Node >= 25 and pnpm >= 10.30.3.

## Architecture

- **Next.js 16** with App Router (`src/app/`)
- **React 19** with React Compiler enabled for automatic memoization
- **Tailwind CSS v4** via PostCSS plugin — utility-first styling with dark mode (`dark:` prefix) and CSS custom properties for theming in `globals.css`
- **shadcn/ui** (new-york style) — component primitives built on Radix UI, styled with CVA + tailwind-merge + clsx via the `cn()` utility (`src/lib/utils.ts`)
- **Lucide React** for icons
- **tw-animate-css** for animations
- **Geist** font family (sans + mono)
- **TypeScript** in strict mode — path alias `@/*` → `src/*`
- Licensed under GPL-3.0

## Tooling

- **Biome** for linting and formatting — 2-space indent, auto-organize imports
- **Ultracite** — zero-config code quality preset extending Biome (`biome.json` extends `ultracite/biome/core` and `ultracite/biome/next`)
- **Vitest** for testing
- **Lefthook** for git hooks — pre-commit runs `ultracite fix` on staged files
