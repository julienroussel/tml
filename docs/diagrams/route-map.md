# Route Map

<!-- Last verified: 2026-03-20 -->

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
  n23 --> n24["faq"]
  n24 --> n25(["page.tsx"])
  n23 --> n27(["page.tsx"])
  n23 --> n28["privacy"]
  n28 --> n29(["page.tsx"])
  root --> n30["api"]
  n30 --> n31["auth"]
  n31 --> n32["[...path]"]
  n32 --> n33(["API: route.ts"])
  n30 --> n34["email"]
  n34 --> n35["unsubscribe"]
  n35 --> n36(["API: route.ts"])
  root --> n37["auth"]
  n37 --> n38["[path]"]
  n38 --> n39(["page.tsx"])
```

## Route Groups

### `(marketing)/` — Public Pages
- `/` — Landing page (hero, features, CTAs)
- `/privacy` — Privacy policy
- `/faq` — Frequently asked questions

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
