# Route Map

<!-- Last verified: 2026-03-24 -->

## Route Structure

```mermaid
graph TD
  root["src/app/"]
  root --> n0["(app)"]
  n0 --> n1["account"]
  n1 --> n2["[path]"]
  n2 --> n3(["page.tsx"])
  n0 --> n4["admin"]
  n4 --> n5(["page.tsx"])
  n0 --> n6["collect"]
  n6 --> n7(["page.tsx"])
  n0 --> n8["dashboard"]
  n8 --> n9(["page.tsx"])
  n0 --> n10["enhance"]
  n10 --> n11(["page.tsx"])
  n0 --> n12["improve"]
  n12 --> n13(["page.tsx"])
  n0 --> n15["perform"]
  n15 --> n16(["page.tsx"])
  n0 --> n17["plan"]
  n17 --> n18(["page.tsx"])
  n0 --> n19["settings"]
  n19 --> n20(["page.tsx"])
  n0 --> n21["train"]
  n21 --> n22(["page.tsx"])
  root --> n23["(marketing)"]
  n23 --> n24["[locale]"]
  n24 --> n25["faq"]
  n25 --> n26(["page.tsx"])
  n24 --> n28(["page.tsx"])
  n24 --> n29["privacy"]
  n29 --> n30(["page.tsx"])
  root --> n31["api"]
  n31 --> n32["auth"]
  n32 --> n33["[...path]"]
  n33 --> n34(["API: route.ts"])
  n31 --> n35["cron"]
  n35 --> n36["cleanup"]
  n36 --> n37(["API: route.ts"])
  n31 --> n38["email"]
  n38 --> n39["unsubscribe"]
  n39 --> n40(["API: route.ts"])
  n31 --> n41["powersync"]
  n41 --> n42["batch"]
  n42 --> n43(["API: route.ts"])
  root --> n44["auth"]
  n44 --> n45["[path]"]
  n45 --> n46(["page.tsx"])
```

## Route Groups

### `(marketing)/[locale]/` — Public Pages (statically generated)
- `/[locale]` — Landing page (hero, features, CTAs) — 7 locale variants
- `/[locale]/privacy` — Privacy policy — 7 locale variants
- `/[locale]/faq` — Frequently asked questions — 7 locale variants
- Bare paths (`/`, `/faq`, `/privacy`) are 302-redirected by proxy to locale-prefixed versions

### `(app)/` — Authenticated App
- `/dashboard` — Main dashboard
- `/improve` — Practice session logging
- `/train` — Goal setting and drills
- `/plan` — Routine builder
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
