---
paths:
  - "src/db/schema/**"
  - "src/db/migrations/**"
  - "drizzle.config.ts"
---

# Migration Workflow

**Invoke the `/migrations` skill** — it enforces the full workflow (generate → review SQL → migrate → regenerate sync artifacts → reset dev branch → regenerate docs). Hand-rolling is error-prone.

**Two safety rules the skill guards — also flag them in any review**:

1. **Single migration file for dependent SQL.** `@neondatabase/serverless` runs each migration file as an independent HTTP call, so DDL from one file is **not visible** to the next within the same `drizzle-kit migrate` run. Never split dependent statements across files. Hand-written additions (e.g., RLS policies) that depend on a generated migration must be appended to that same file.
2. **Journal timestamps must be monotonically increasing.** Drizzle-orm only applies migrations whose `when` in `meta/_journal.json` is greater than the last applied. Out-of-order entries are **silently skipped**. After generating or editing a migration, verify the new `when` is strictly greater than every previous entry.
