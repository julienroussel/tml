# The Magic Lab

**Train. Plan. Perform. Elevate your magic.**

Every great magic performance starts long before the curtain rises. It starts with hours of practice, careful routine planning, and a deep understanding of your own repertoire.

The Magic Lab is your personal space to do all of that — and more. Built by magicians, for magicians, it's designed to support every stage of your journey:

- **Improve** — Log practice sessions and track your progress on individual sleights, moves, and techniques.
- **Train** — Set goals, build drills, and stay consistent with structured practice.
- **Plan** — Assemble and fine-tune your sets, from a quick close-up routine to a full stage show.
- **Perform** — Keep notes on your performances, track audience reactions, and learn from every show.
- **Enhance** — Discover new ideas, revisit what works, and continuously raise the bar.
- **Collect** — Register and organize your props, books, gimmicks, and other items. Track, sort, and collect data on everything in your magician's toolkit.

Whether you're working on your first ambitious card routine or polishing a headline act, The Magic Lab keeps your craft organized and your growth intentional.

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Requires Node 24.x and pnpm >= 10.

## Scripts

```bash
pnpm dev            # Start dev server
pnpm build          # Production build
pnpm start          # Start production server
pnpm lint           # Lint and format check (Ultracite)
pnpm fix            # Auto-fix lint and format issues
pnpm test           # Run tests in watch mode
pnpm test:run       # Run tests once
pnpm test:coverage  # Run tests with coverage
pnpm test:ui        # Open Vitest UI
```

## Tech Stack

- [Next.js 16](https://nextjs.org/) with App Router
- [React 19](https://react.dev/) with React Compiler
- [Tailwind CSS v4](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/) component primitives
- [Vitest](https://vitest.dev/) for testing
- [Biome](https://biomejs.dev/) via [Ultracite](https://github.com/haydenbleasel/ultracite) for linting and formatting
- PWA support with push notifications

## Deployment

Hosted on [Vercel](https://vercel.com/). Pushes to `main` trigger automatic deployments.

## License

[GPL-3.0](LICENSE)
