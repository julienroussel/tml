# Route Map

<!-- Last verified: 2026-04-29 -->

## Route Structure

```mermaid
graph TD
  root["src/app/"]
  root --> n0["(app)"]
  n0 --> n1["account"]
  n1 --> n2["[path]"]
  n2 --> n3(["page.tsx"])
  n0 --> n4["activity"]
  n4 --> n5(["page.tsx"])
  n0 --> n6["admin"]
  n6 --> n7(["page.tsx"])
  n0 --> n8["collect"]
  n8 --> n9(["page.tsx"])
  n0 --> n10["dashboard"]
  n10 --> n11(["page.tsx"])
  n0 --> n12["enhance"]
  n12 --> n13(["page.tsx"])
  n0 --> n14["improve"]
  n14 --> n15(["page.tsx"])
  n0 --> n17["perform"]
  n17 --> n18(["page.tsx"])
  n0 --> n19["plan"]
  n19 --> n20(["page.tsx"])
  n0 --> n21["repertoire"]
  n21 --> n22(["page.tsx"])
  n0 --> n23["settings"]
  n23 --> n24(["page.tsx"])
  n0 --> n25["train"]
  n25 --> n26(["page.tsx"])
  root --> n27["(marketing)"]
  n27 --> n28["[locale]"]
  n28 --> n29["faq"]
  n29 --> n30(["page.tsx"])
  n28 --> n32(["page.tsx"])
  n28 --> n33["privacy"]
  n33 --> n34(["page.tsx"])
  root --> n35["api"]
  n35 --> n36["auth"]
  n36 --> n37["[...path]"]
  n37 --> n38(["API: route.ts"])
  n35 --> n39["cron"]
  n39 --> n40["cleanup"]
  n40 --> n41(["API: route.ts"])
  n35 --> n42["email"]
  n42 --> n43["unsubscribe"]
  n43 --> n44(["API: route.ts"])
  n35 --> n45["powersync"]
  n45 --> n46["batch"]
  n46 --> n47(["API: route.ts"])
  root --> n48["auth"]
  n48 --> n49["[path]"]
  n49 --> n50(["page.tsx"])
```

## Route Groups

### `(marketing)/[locale]/` — Public Pages (statically generated)
- `/[locale]` — Landing page (hero, features, CTAs) — 7 locale variants
- `/[locale]/privacy` — Privacy policy — 7 locale variants
- `/[locale]/faq` — Frequently asked questions — 7 locale variants
- Bare paths (`/faq`, `/privacy`) are 302-redirected by proxy to locale-prefixed versions
- The root path `/` redirects authenticated users to `/dashboard`, unauthenticated users to the locale-prefixed landing page

### `(app)/` — Authenticated App
- `/dashboard` — Main dashboard
- `/improve` — Practice session logging
- `/train` — Goal setting and drills
- `/plan` — Setlist builder
- `/perform` — Performance tracking
- `/enhance` — Insights and suggestions
- `/collect` — Inventory management
- `/settings` — User preferences
- `/account/[path]` — Neon Auth account management
- `/admin` — Admin dashboard (role-restricted)

### `auth/` — Auth Pages
- `/auth/[path]` — Sign-in, sign-up (Neon Auth UI)

### `api/` — API Routes
- `/api/auth/[...path]` — Neon Auth (Better Auth) catch-all
- `/api/email/unsubscribe` — Email unsubscribe endpoint
