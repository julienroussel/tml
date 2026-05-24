# Route Map

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
  n0 --> n12["dev"]
  n12 --> n13["sync-status"]
  n13 --> n14(["page.tsx"])
  n0 --> n15["enhance"]
  n15 --> n16(["page.tsx"])
  n0 --> n17["improve"]
  n17 --> n18(["page.tsx"])
  n0 --> n20["perform"]
  n20 --> n21(["page.tsx"])
  n0 --> n22["plan"]
  n22 --> n23(["page.tsx"])
  n0 --> n24["repertoire"]
  n24 --> n25(["page.tsx"])
  n0 --> n26["settings"]
  n26 --> n27(["page.tsx"])
  n0 --> n28["train"]
  n28 --> n29(["page.tsx"])
  root --> n30["(marketing)"]
  n30 --> n31["[locale]"]
  n31 --> n32["faq"]
  n32 --> n33(["page.tsx"])
  n31 --> n35(["page.tsx"])
  n31 --> n36["privacy"]
  n36 --> n37(["page.tsx"])
  root --> n38["api"]
  n38 --> n39["auth"]
  n39 --> n40["[...path]"]
  n40 --> n41(["API: route.ts"])
  n38 --> n42["cron"]
  n42 --> n43["cleanup"]
  n43 --> n44(["API: route.ts"])
  n38 --> n45["email"]
  n45 --> n46["unsubscribe"]
  n46 --> n47(["API: route.ts"])
  n38 --> n48["powersync"]
  n48 --> n49["batch"]
  n49 --> n50(["API: route.ts"])
  root --> n51["auth"]
  n51 --> n52["[path]"]
  n52 --> n53(["page.tsx"])
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
