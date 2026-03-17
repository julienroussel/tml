# Local Development

Guide for setting up and running The Magic Lab locally.

## Prerequisites

- **Node.js 24.x** (use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) to manage versions)
- **pnpm >= 10** (`corepack enable && corepack prepare pnpm@latest --activate`)
- **Git**

## Quick Start

```bash
# Clone the repository
git clone https://github.com/julienroussel/tml.git
cd tml

# Install dependencies
pnpm install

# Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Create a `.env.local` file in the project root. Required variables (when backend is integrated):

```bash
# Database (Neon)
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require

# Sync (PowerSync) — leave empty for local-only mode
NEXT_PUBLIC_POWERSYNC_URL=
# Neon Data API — used by PowerSync connector for uploads
NEXT_PUBLIC_NEON_DATA_API_URL=

# Auth (Neon Auth) — copy Auth URL from Neon Console > Auth > Configuration
NEON_AUTH_BASE_URL=
NEON_AUTH_COOKIE_SECRET=  # openssl rand -base64 32

# Push (VAPID) — npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here

# App URL — used for email unsubscribe links (defaults to https://themagiclab.app)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Email (Resend)
RESEND_API_KEY=
```

The app can run without backend services for frontend-only development — leave sync and auth variables empty.

## Database Setup

### Neon Dev Branch

Each developer gets their own Neon database branch:

```bash
# Create a dev branch (via Neon CLI or dashboard)
neonctl branches create --name dev/your-name

# Set DATABASE_URL to the branch connection string
```

Benefits:
- Isolated from production data
- Can be reset/recreated freely
- Branches are cheap (copy-on-write)

### Running Migrations

```bash
# Generate migration from schema changes
pnpm drizzle-kit generate

# Apply pending migrations
pnpm drizzle-kit migrate

# Open Drizzle Studio for visual inspection
pnpm drizzle-kit studio
```

## PowerSync Cloud Dev Instance

- Use a separate PowerSync Cloud instance for development
- Configure sync rules to match the dev database
- Point `NEXT_PUBLIC_POWERSYNC_URL` to the dev instance

## Auth on Localhost

Neon Auth works on localhost out of the box:

- Set `NEON_AUTH_BASE_URL` to your Neon Auth URL from the console
- Set `NEON_AUTH_COOKIE_SECRET` (generate with `openssl rand -base64 32`)
- Google OAuth: Add `http://localhost:3000` to authorized JavaScript origins and redirect URIs in the Google Cloud Console

## Push Notifications on Localhost

Push notifications work on localhost in most browsers:

1. Generate VAPID keys: `npx web-push generate-vapid-keys`
2. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in `.env.local`
3. The service worker (`public/sw.js`) is served by the Next.js dev server
4. Chrome, Edge, and Firefox support push on `localhost`
5. Safari requires HTTPS -- use a tunneling service for testing

## Email

- **Provider**: Resend
- **Dev mode**: Resend provides a test API key that logs emails instead of sending
- Set `RESEND_API_KEY` to your Resend dev key

## Available Scripts

```bash
pnpm dev              # Start dev server (with hot reload)
pnpm build            # Production build
pnpm start            # Start production server
pnpm lint             # Lint and format check (Ultracite/Biome)
pnpm fix              # Auto-fix lint and format issues
pnpm test             # Run tests in watch mode
pnpm test:run         # Run tests once
pnpm test:coverage    # Run tests with coverage report
pnpm test:ui          # Open Vitest UI in browser
pnpm typecheck        # TypeScript type checking
```

## Mobile Testing

To test the PWA on a mobile device on the same network:

1. Find your local IP: `ipconfig getifaddr en0` (macOS)
2. Start the dev server: `pnpm dev --hostname 0.0.0.0`
3. Open `http://YOUR_IP:3000` on your mobile device
4. Note: Push notifications require HTTPS on mobile -- use a tunneling service

## Code Quality

- **Pre-commit hook**: Lefthook runs `ultracite fix` on staged files automatically
- **Biome**: Formatting (2-space indent) and linting
- **TypeScript**: Strict mode enabled, path alias `@/*` mapped to `src/*`

## See Also

- [architecture.md](./architecture.md) -- Tech stack and architecture overview
- [testing.md](./testing.md) -- Testing strategy and patterns
- [migrations.md](./migrations.md) -- Database migration workflow
