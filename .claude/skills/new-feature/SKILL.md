---
name: new-feature
description: "Scaffold a new feature end-to-end: feature directory, database schema, migration, PowerSync sync schema, app route, translations, components with empty/loading/error states, tests, module registry, CSP update, and docs regeneration. Use when adding a major new feature to the app."
user-invocable: true
---

# New Feature Scaffold

Run this skill to scaffold a new feature following the project checklist.

## Steps

### 1. Gather requirements
Ask the user for:
- **Feature name** (slug, e.g. `improve`, `collect`)
- **Description** (one sentence)
- **Data model** (what tables/columns are needed)
- **Icon** (from Lucide React)
- **Is it a new module?** (needs entry in `src/lib/modules.ts`)

### 2. Create feature directory
```
src/features/<name>/
  components/    # Feature-specific components
  hooks/         # Feature-specific hooks
  types.ts       # Feature-specific types
```

### 3. Create server schema
Add `src/db/schema/<name>.ts` with a Drizzle `pgTable()` definition. Follow conventions:
- UUID v7 primary keys
- `user_id` FK to `users.id`
- `created_at` / `updated_at` / `deleted_at` timestamps
- Branded ID types
- Export from `src/db/schema/index.ts`

### 4. Generate and apply migration
```bash
pnpm db:generate
# Review the SQL
pnpm db:migrate
```

### 5. Update PowerSync client schema
Add the table to `src/sync/schema.ts` with matching columns (all as `column.text` or `column.integer`).

### 6. Create app route
```
src/app/(app)/<name>/
  page.tsx        # Main page component
  page.test.tsx   # Page tests
  layout.tsx      # Layout (if needed)
```

### 7. Add translation keys
Add keys to all 7 locale files (`src/i18n/messages/*.json`):
- `<name>.title` — Page title
- `<name>.description` — Page description
- `<name>.emptyState` — Empty state message
- Any feature-specific strings

### 8. Build components with states
Every feature needs:
- **Empty state**: Icon + title + description + primary CTA (use `ModuleComingSoon` pattern if not yet implemented)
- **Loading state**: Skeleton for cold start only (offline-first means data is usually instant)
- **Error state**: Error boundary with retry button

### 9. Write tests
Co-located test files (`foo.test.ts` next to `foo.ts`). Target 80%+ coverage. Use test utilities from `src/test/`:
- `factories.ts` for test data
- `mocks.ts` for Next.js mocks
- `render.tsx` for custom render wrapper

### 10. Update module registry
If this is a new module, add an entry to `src/lib/modules.ts`:
```ts
{
  slug: "<name>",
  label: "<Label>",
  description: "<Description>",
  icon: <LucideIcon>,
  enabled: false,  // Start disabled, enable when ready
  group: "main",
}
```

### 11. Update CSP (if needed)
If the feature uses external services, update `src/lib/csp.ts`.

### 12. Regenerate docs
```bash
pnpm docs:generate
```

### 13. Final checks
```bash
pnpm lint          # Check formatting
pnpm test:run      # Run tests
pnpm build         # Verify production build
```

## UI/Design Conventions
- **Mobile-first**: Design for <768px first
- **Touch targets**: Minimum 44x44px (`min-h-11 min-w-11`)
- **Animations**: Sub-200ms, functional only, use `motion-safe:` prefix
- **Accent color**: Violet (oklch hue 280)
