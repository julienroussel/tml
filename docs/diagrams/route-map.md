# Route Map

<!-- Last verified: 2026-04-07 -->

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
  n0 --> n19["repertoire"]
  n19 --> n20(["page.tsx"])
  n0 --> n21["settings"]
  n21 --> n22(["page.tsx"])
  n0 --> n23["train"]
  n23 --> n24(["page.tsx"])
  root --> n25["(marketing)"]
  n25 --> n26["[locale]"]
  n26 --> n27["faq"]
  n27 --> n28(["page.tsx"])
  n26 --> n30(["page.tsx"])
  n26 --> n31["privacy"]
  n31 --> n32(["page.tsx"])
  root --> n33["api"]
  n33 --> n34["auth"]
  n34 --> n35["[...path]"]
  n35 --> n36(["API: route.ts"])
  n33 --> n37["cron"]
  n37 --> n38["cleanup"]
  n38 --> n39(["API: route.ts"])
  n33 --> n40["email"]
  n40 --> n41["unsubscribe"]
  n41 --> n42(["API: route.ts"])
  n33 --> n43["powersync"]
  n43 --> n44["batch"]
  n44 --> n45(["API: route.ts"])
  root --> n46["auth"]
  n46 --> n47["[path]"]
  n47 --> n48(["page.tsx"])
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
