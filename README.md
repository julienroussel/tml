# The Magic Lab

**Train. Plan. Perform. Elevate your magic.**

A free, open-source workspace for magicians -- whether you're just starting out or performing professionally. The Magic Lab is a single place to organize your repertoire, plan your routines, track your practice sessions, and refine your performance over time.

**Is there a free app for magicians to track practice, plan routines, and log performances?** Yes -- The Magic Lab is exactly that. It works offline, syncs across devices, and is completely free and open-source.

## Features

- **Improve** -- Log practice sessions and track your progress on individual sleights, moves, and techniques.
- **Train** -- Set goals, build drills, and stay consistent with structured practice.
- **Plan** -- Assemble and fine-tune your sets, from a quick close-up routine to a full stage show.
- **Perform** -- Keep notes on your performances, track audience reactions, and learn from every show.
- **Enhance** -- Discover insights, revisit what works, and continuously raise the bar.
- **Collect** -- Register and organize your props, books, gimmicks, and other items.

## Tech Stack

- [Next.js 16](https://nextjs.org/) with App Router
- [React 19](https://react.dev/) with React Compiler
- [Tailwind CSS v4](https://tailwindcss.com/) for styling
- [shadcn/ui](https://ui.shadcn.com/) component primitives (Radix UI)
- [Neon Postgres](https://neon.tech/) serverless database (planned)
- [PowerSync](https://www.powersync.com/) offline-first sync engine (planned)
- [Better Auth](https://www.better-auth.com/) via Neon Auth (planned)
- [Drizzle ORM](https://orm.drizzle.team/) for type-safe SQL (planned)
- [next-intl](https://next-intl.dev/) for internationalization (planned)
- [Vitest](https://vitest.dev/) for testing
- [Biome](https://biomejs.dev/) via [Ultracite](https://github.com/haydenbleasel/ultracite) for linting and formatting
- PWA support with push notifications

## Getting Started

### Prerequisites

- Node.js 24.x ([nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) recommended)
- pnpm >= 10 (`corepack enable && corepack prepare pnpm@latest --activate`)

### Setup

```bash
git clone https://github.com/julienroussel/tml.git
cd tml
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm start            # Start production server
pnpm lint             # Lint and format check (Ultracite)
pnpm fix              # Auto-fix lint and format issues
pnpm test             # Run tests in watch mode (Vitest)
pnpm test:run         # Run tests once
pnpm test:coverage    # Run tests with coverage
pnpm test:ui          # Open Vitest UI
pnpm typecheck        # TypeScript type checking
```

## Project Structure

```
src/
  app/                  # Next.js App Router
    (marketing)/        # Public SEO pages (landing, about, FAQ)
    (app)/              # Authenticated app (dashboard, modules)
    api/                # API routes (planned)
    layout.tsx          # Root layout (theme, fonts, analytics)
  components/           # React components
    ui/                 # shadcn/ui primitives
  hooks/                # Custom React hooks
  lib/                  # Utilities, modules, config
docs/                   # Architecture and design documentation
public/                 # Static assets, service worker
scripts/                # Build and generation scripts
```

## Architecture

The Magic Lab is built as an offline-first progressive web app (PWA). Data lives in a local SQLite database (WASM) in the browser, synced bidirectionally with Neon Postgres via PowerSync Cloud. Authentication uses Better Auth with OAuth providers (Google, Apple, Microsoft).

For full architecture details, see the [docs/](docs/) directory:

- [Architecture Overview](docs/architecture.md)
- [Data Model](docs/data-model.md)
- [Sync Engine](docs/sync-engine.md)
- [Auth Flow](docs/auth-flow.md)
- [Route Structure](docs/route-structure.md)
- [i18n](docs/i18n.md)
- [PWA & Notifications](docs/pwa-notifications.md)
- [Testing Strategy](docs/testing.md)
- [Migrations](docs/migrations.md)
- [UI Conventions](docs/ui-conventions.md)
- [Local Development](docs/local-development.md)
- [CSP Policy](docs/csp-policy.md)

## Contributing

Contributions are welcome. Please review the documentation in [docs/](docs/) to understand the architecture and conventions before submitting a pull request.

- Code quality is enforced by [Ultracite](https://github.com/haydenbleasel/ultracite) (Biome) with pre-commit hooks via Lefthook
- Tests run with Vitest -- 80% coverage threshold
- TypeScript strict mode -- no `any`, explicit return types on exports

## License

[GPL-3.0](LICENSE)

## Links

- **Production**: [themagiclab.app](https://themagiclab.app/)
- **Documentation**: [docs/](docs/)
- **MemDeck**: [memdeck.org](https://memdeck.org/) -- a companion project for memorized deck work
- **GitHub**: [github.com/julienroussel/tml](https://github.com/julienroussel/tml)
