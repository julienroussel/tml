---
paths:
  - "src/lib/csp.ts"
  - "public/sw.js"
---

# CSP Rules

- **Builder**: `src/lib/csp.ts` — typed, environment-aware.
- **Test after changes**: verify CSP doesn't block required resources. For hash-based CSP or anything depending on rendered HTML, run `pnpm build` and inspect actual output — source-level reasoning has missed production realities (memory: `feedback_verify_against_real_build.md`).
- **Dev mode**: HMR WebSocket sources, Drizzle Studio frame-src.
- **PowerSync**: `connect-src` for `https://*.powersync.journeyapps.com`.
- **Vercel**: `connect-src` for analytics and speed insights.
