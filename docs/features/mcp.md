# Plan — TML MCP server: scope, sequencing, and risks

## Context

The user is committed to building an MCP (Model Context Protocol) server for The Magic Lab (TML) so magicians can use their repertoire, collection, and activity data from inside Claude Desktop, ChatGPT, and Gemini. TML is in **pre-launch / growing** mode (no monetization yet, working toward a public launch), and the user has elected to invest 1–2 weeks in MCP regardless of validated demand, with the goal of full cross-vendor LLM client parity.

This plan accepts those constraints and answers the higher-leverage question: *how* to build the MCP server so it doesn't become a maintenance trap, a privacy liability, or a forward-compat anchor on the disabled Lab modules. The original "should we / shouldn't we" framing is moot given the user's commitment, so the recommendation is **yes, here is how**.

## TL;DR

Build the MCP server, but **scope its v1 data surface to the three currently-enabled modules only** (`repertoire`, `collect`, `activity`), pair it with a **per-user signed `llms.txt` URL in parallel** so users on consumer-tier ChatGPT/Gemini still get value from day one, and **resolve the OAuth strategy first** — TML's existing auth (`@neondatabase/auth@0.2.0-beta.1`, which is a managed Better Auth service per [Neon Auth docs](https://neon.com/docs/auth/overview)) currently exposes only 5 plugins (Admin, Email OTP, JWT, Organization, Open API per [Neon Auth plugin docs](https://neon.com/docs/auth/guides/plugins)). The Better Auth MCP plugin and OAuth Provider plugin are **not in that list** today, so MCP OAuth cannot be served directly from Neon Auth's managed surface. The auth strategy decision (managed vendor vs. self-host a Better Auth instance for MCP only vs. wait for Neon Auth to expose the plugin) is the riskiest single decision and must come before any code is written.

Realistic engineering cost is **~9–13 days end-to-end** with the recommended Vercel-native stack: **Vercel MCP Adapter (`mcp-handler`) + WorkOS AuthKit** (Marketplace integration; Stytch is the alternate). This is faster than hand-rolling transport because the adapter handles Streamable HTTP and the provider handles spec-compliant OAuth (PKCE / RFC 8707 / DCR). The single biggest design decision is the scope boundary: do not expose tables from disabled modules (`practice_sessions`, `setlists`, `performances`, `goals`, `practice_session_tricks`, `setlist_tricks`) in the MCP schema. Once they're public, every Lab module launch becomes a coordinated breaking change, and that ratchet is permanent.

---

## What "TML MCP" will be

A **remote MCP server** speaking Streamable HTTP (the March 2025 spec replacement for HTTP+SSE — see [Zylos research](https://zylos.ai/research/2026-03-08-mcp-remote-evolution-streamable-http-enterprise-adoption)), authenticated as an OAuth 2.1 resource server per the [MCP authorization spec](https://modelcontextprotocol.io/specification/draft/basic/authorization), exposing the authenticated user's data as resources and tools to Claude Desktop, ChatGPT (Developer Mode for Business/Enterprise/Edu plans — see [OpenAI help center](https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta)), and Gemini (API/SDK and Gemini CLI — [Google Cloud blog](https://cloud.google.com/blog/products/ai-machine-learning/announcing-official-mcp-support-for-google-services), [Gemini CLI MCP docs](https://geminicli.com/docs/tools/mcp-server/)).

The 14 tables in `src/db/schema/` (per Explore Agent A) split cleanly into three groups for MCP-exposure decisions:

| Group | Tables | MCP v1 decision |
|---|---|---|
| **Enabled & PowerSync-synced** | `tricks`, `tags`, `trick_tags`, `items`, `item_tags`, `item_tricks`, `event_log` | **Expose** as resources + tools. These have a UI today. |
| **Disabled-module shells (synced)** | `practice_sessions`, `practice_session_tricks`, `setlists`, `setlist_tricks`, `performances`, `goals` | **DO NOT expose in v1.** Add when each Lab module launches; bumping the MCP schema is cheaper than carrying a public surface for unfinished features. |
| **Server-only (PII/auth)** | `users`, `user_preferences`, `push_subscriptions` (per `scripts/generate-sync.ts:SERVER_ONLY_TABLES`) | **NEVER expose.** Hard-coded denylist. |

## Data surface, v1

| MCP primitive | Source | Notes |
|---|---|---|
| Resource: `tml://repertoire/tricks` | `tricks`, `trick_tags` | Read; flat JSON list; respects soft-delete (`deletedAt is null`) |
| Resource: `tml://repertoire/tags` | `tags` | Read |
| Resource: `tml://collect/items` | `items`, `item_tags`, `item_tricks` | Read; soft-delete aware |
| Resource: `tml://activity/events` | `event_log` | Read; subscribable stream once `feat/event-log` lands on `main` |
| Tool: `add_trick(input)` | `tricks` insert | Write; emit `event_log` entry via `logEventServer` |
| Tool: `update_trick(id, patch)` | `tricks` update | Write; emit event |
| Tool: `delete_trick(id)` | `tricks` soft-delete | Write; emit event |
| Tool: `tag_trick(trickId, tagIds)` | `trick_tags` upsert | Write; emit event |
| Tool: `add_item(input)`, `update_item`, `delete_item` | `items` | Write; emit event |
| Tool: `link_item_to_trick(itemId, trickId)` | `item_tricks` | Write; emit event |
| Tool: `suggest_setlist_from_repertoire(constraints)` | `tricks` read | Higher-level synthesis; pure read, no mutation |

**Audit trail is free.** Every write goes through the existing `logEventServer` path (`src/lib/events/`), so MCP writes produce identical event_log entries to UI writes. This is the strongest single reason to build MCP *after* `feat/event-log` lands on `main` rather than in parallel with it.

---

## Auth strategy — the gating decision

TML uses `@neondatabase/auth@0.2.0-beta.1` (`package.json:52`), which is a managed Better Auth service ([Neon Auth overview](https://neon.com/docs/auth/overview): "Neon Auth is a managed Better Auth service. Neon Auth currently supports Better Auth version 1.4.18.").

The [Neon Auth plugin guide](https://neon.com/docs/auth/guides/plugins) is explicit: managed Neon Auth currently exposes **5 plugins only** (Admin, Email OTP, JWT, Organization, Open API), and "you don't install or configure Better Auth plugins directly" — plugins function only through Neon's managed interface.

Better Auth's [MCP plugin](https://better-auth.com/docs/plugins/mcp) and [OAuth Provider plugin](https://better-auth.com/docs/plugins/oauth-provider) are NOT in Neon Auth's supported set today. This means the existing auth instance **cannot serve as an OAuth 2.1 authorization server for MCP clients** out of the box. Three viable paths:

| Option | Description | Pros | Cons | Recommended? |
|---|---|---|---|---|
| **A. Vercel MCP Adapter + Marketplace OAuth provider** | Use Vercel's `mcp-handler` package for the MCP server itself (BYO-auth via `verifyToken`); pair it with a Marketplace-provisioned auth provider (WorkOS AuthKit default; Stytch alternate). The provider issues OAuth 2.1 tokens; the adapter verifies them. User logs in to TML via Neon Auth; when they mint MCP credentials, TML server-to-server calls the provider API to bridge their TML `user_id`. | Vercel-native (per CLAUDE.md "Platform Preferences"); auto-provisioned env vars; provider handles spec compliance (PKCE, RFC 8707, DCR/CIMD); MCP transport / Streamable HTTP / routing all handled by the adapter; one-click deploy templates exist. | Vendor lock-in; second auth system; needs identity-bridging glue (TML user_id ↔ vendor identity); per-MAU cost above the free tier (typically ~1k MAU free for both WorkOS and Stytch). | **Yes (default)** — direct match for CLAUDE.md's Vercel-native preference; lowest engineering cost. Verify RFC 8707 in the spike (Vercel's MCP Adapter docs don't mention it; the provider must). |
| **B. Self-hosted OAuth (Better Auth instance, or hand-rolled)** | Either: (i) a second, self-hosted Better Auth instance with the [MCP plugin](https://better-auth.com/docs/plugins/mcp) / [OAuth Provider plugin](https://better-auth.com/docs/plugins/oauth-provider); or (ii) hand-rolled using a reference implementation like [raxITai/mcp-oauth-sample](https://github.com/raxITai/mcp-oauth-sample) (Next.js 15 + Postgres + RFC 8707 + PKCE + DCR; uses NextAuth.js for user auth). | Single auth ecosystem (Better Auth) or full control (hand-rolled); free (no vendor cost); plugins are open-source. | You're now responsible for OAuth security patches and spec migrations (DCR → CIMD, future changes); 3–5 extra days of work; identity-sync between Neon Auth and the OAuth instance. Better Auth's OAuth Provider Plugin docs don't currently mention RFC 8707 — would need to add it manually. | Only if Option A vendor cost or terms are unacceptable. |
| **C. Wait for Neon Auth to expose the plugin** | Per Neon: "additional plugin options may arrive over time per the roadmap." | Zero engineering on auth. | Indefinite timeline; blocks the project. | **No** — incompatible with "already committed" timeline. |

**Recommended: Option A** — Vercel MCP Adapter (`mcp-handler` per [Vercel changelog: OAuth support added to MCP Adapter](https://vercel.com/changelog/oauth-support-added-to-mcp-adapter)) + WorkOS AuthKit ([Vercel MCP + WorkOS AuthKit template](https://workos.com/blog/vercel-mcp-workos-authkit-template)) as the Phase A baseline. Stytch ([Stytch + Vercel MCP guide](https://stytch.com/docs/guides/connected-apps/mcp-servers/vercel)) is the alternate; Descope and Clerk are also on the Marketplace.

Decision criteria for the spike: (1) explicit RFC 8707 Resource Indicators support, (2) external-identity bridging (provider stores TML `user_id` as a stable claim), (3) Marketplace integration with auto-provisioned env vars, (4) free tier covering pre-launch traffic, (5) MCP-specific docs/templates that match the Vercel MCP Adapter's `verifyToken` shape.

The remainder of this plan assumes Option A. If the spike rules out all Marketplace providers, fall back to Option B and add ~3–5 days for self-hosting + spec compliance.

### Why not code it ourselves?

You asked: "I guess this is not a hard part using a dedicated library." Honest answer: **the simple bearer-token case is easy; the spec-compliant OAuth 2.1 authorization server is not.** Specifically:

- **What's easy** (½–1 day): Issuing a long-lived signed token (JWT) at credential-mint time, verifying it at the MCP endpoint, scoping queries to the user. This is "personal access tokens" — works for power users hitting the MCP server programmatically.
- **What's hard** (3–5+ days, security-sensitive): A spec-compliant OAuth 2.1 authorization server with PKCE, refresh tokens, RFC 8707 Resource Indicators, RFC 7591 Dynamic Client Registration (or 2025-11-25 CIMD), authorization-code dance, JWKS rotation, token revocation, introspection, WWW-Authenticate headers. Reference implementations like [raxITai/mcp-oauth-sample](https://github.com/raxITai/mcp-oauth-sample) exist and are deployable to Vercel — viable starting point. But: Claude Desktop, ChatGPT, and Gemini all expect the full OAuth 2.1 flow for "Add MCP server" GUIs to work. Skipping it limits you to power users pasting tokens into config files manually.

The Vercel-native option (A) gets the easy part (verifyToken) and the hard part (provider handles it) for the lowest total engineering cost. Coding it ourselves is a viable Option B fallback, not a default.

---

## How Neon Auth and MCP OAuth coexist

You asked: should this be handled by a single auth module or two living alongside? **Two modules — and not because of the Neon-Auth plugin gap, but because the two flows are protocolically different and serve different audiences.** Even if Neon Auth shipped the MCP plugin tomorrow, you'd still have two distinct flows under the hood.

### The two flows are inherently different

| | Browser session (Neon Auth, today) | MCP OAuth (new, Phase A onward) |
|---|---|---|
| **Audience** | Humans in a browser | Machine clients (Claude Desktop, ChatGPT, Gemini) |
| **Credential** | Cookie (`__Secure-neon-auth.session_token`) | Bearer token in `Authorization` header |
| **Lifetime** | Long-lived session, refresh on activity | Short-lived access token + refresh token |
| **Issuance trigger** | Sign-in form / email link / OAuth provider | OAuth 2.1 authorization-code dance with PKCE + RFC 8707 Resource Indicators |
| **Where validated** | `src/proxy.ts` middleware via `auth.getSession()` (`src/auth/server.ts:14`) | MCP route handler via vendor introspection or JWT signature verification |
| **What it protects** | Server actions, `(app)` route group, PowerSync upload | MCP server endpoints (`/api/mcp/*`) and Phase B `/u/<token>/llms.txt` |
| **Spec compliance** | Internal — your choice | External — Claude Desktop / ChatGPT / Gemini will reject non-compliant flows |

These cannot be merged into "one credential type." The MCP spec mandates OAuth 2.1 bearer tokens, and browsers don't speak that protocol for ordinary navigation. The two flows must coexist regardless of whether they're served by one auth instance or two.

### Today's reality (managed Neon Auth + Option A vendor)

```
                 ┌──────────────────────────────────────┐
                 │        TML user identity (Neon)       │
                 │     users.id = <stable TML user_id>   │
                 └───────┬─────────────────────┬─────────┘
                         │                     │
                browser sees user_id   MCP client sees user_id
                via cookie session    via OAuth bearer token
                         │                     │
                         ▼                     ▼
        ┌──────────────────────┐   ┌───────────────────────────────┐
        │ Neon Auth (managed)  │   │ WorkOS AuthKit (Marketplace)  │
        │ Better Auth 1.4.18   │   │  authorization server +       │
        │ • sign-in / sign-up  │   │  resource server primitives   │
        │ • account UI         │   │  • PKCE                       │
        │ • password reset     │   │  • RFC 8707 Resource Indicator│
        │ • social providers   │   │  • DCR/CIMD                   │
        └──────────┬───────────┘   └───────────────┬───────────────┘
                   │                                │
                   ▼                                ▼
        cookie session validated         bearer token verified by
        by `src/auth/server.ts`          Vercel MCP Adapter's `withMcpAuth`
                                          → `src/auth/mcp/verify.ts`
                   │                                │
                   └───────────────┬────────────────┘
                                   ▼
                         same user_id flows into
                         the domain query layer
                         (`src/lib/repertoire/queries.ts`, etc.)
                         + Postgres RLS context
```

Two auth surfaces, one identity. Neither system needs to know about the other at runtime; they share only the `user_id` value.

### Module layout (proposed)

```
src/auth/
├── server.ts            (existing) Neon Auth wrapper, auth.getSession() for browser
├── ensure-user.ts       (existing) user-row provisioning + welcome side effects
└── mcp/                 (new) MCP-OAuth-specific concerns
    ├── verify.ts        verifyMcpToken(headers) → { userId, scopes } | 401
    ├── client.ts        thin OAuth vendor SDK wrapper (Stytch / WorkOS / ...)
    ├── bridge.ts        identity-bridging helpers — runs at credential-mint time
    └── scopes.ts        scope catalog (read:repertoire, write:repertoire, ...)
```

Both auth modules ultimately yield the same domain object — a TML `userId` — so the rest of the app (query layer, route handlers, RLS context) is agnostic to how the request authenticated.

### Identity bridging — the actual lifecycle

The bridge runs at **credential-mint time**, not at every request:

1. **User signs in to TML normally** via Neon Auth (browser cookie session — unchanged from today).
2. **User opens `/settings/integrations`** while authenticated. TML reads `auth.getSession()` to get the TML `user_id`.
3. **User clicks "Connect Claude Desktop."** TML calls the OAuth vendor's server-to-server API to create-or-lookup an external identity keyed by TML `user_id`. The vendor stores `external_user_id = <user_id>` as a stable claim it will include in future tokens.
4. **TML returns the MCP connection URL** (vendor's authorization endpoint + discovery metadata) for the user to paste into Claude Desktop.
5. **Claude Desktop runs the OAuth 2.1 dance** with the vendor's authorization server. The vendor recognizes the previously-bridged identity and issues access + refresh tokens carrying `external_user_id`.
6. **Claude Desktop calls TML's MCP endpoint** with `Authorization: Bearer <token>`. `src/auth/mcp/verify.ts` introspects or JWT-verifies the token, extracts `user_id`, and the request continues as if it were a server action — same `user_id`, same query path, same RLS context, same `event_log` audit trail entry (with `source: 'mcp'`).
7. **Revocation** flows in either direction: revoking an MCP credential at `/settings/integrations` calls the vendor's revocation API; banning a user at the TML side cascades to "delete or disable all bridged identities" via a single helper in `src/auth/mcp/bridge.ts`.

### When to consider unification (i.e., one auth instance)

Don't unify in v1. Revisit if any of these happen:

- **Neon Auth exposes the MCP plugin or OAuth Provider plugin.** Per [Neon's plugin guide](https://neon.com/docs/auth/guides/plugins) — additional plugin options "may arrive over time per the roadmap." If it ships, migrating MCP OAuth from the vendor to Neon-Auth-as-OAuth-server consolidates auth; a valuable cleanup.
- **Vendor per-MAU pricing becomes painful at scale.** At pre-launch volumes this is years away; flag the threshold during the spike.
- **Identity-bridging glue accumulates surprising bugs.** If the vendor's "external identity" abstraction starts mismatching TML's user model (e.g., user soft-delete not propagating), it's a signal to consolidate by self-hosting Better Auth.
- **A second machine-auth use case appears** (third-party integrations beyond MCP, partner APIs). At that point, building an in-house OAuth server has a clearer ROI.

For v1, the two-module split is the right answer — clean responsibility boundaries, minimal blast radius, no migration risk, unblocked by the Neon Auth plugin gap.

---

## Recommended sequencing (~9–13 days)

**Prerequisite — Land `feat/event-log` on `main` first.** The branch is currently active per `git status`. MCP's audit story collapses without it. Don't fork two large efforts. Out-of-scope for the MCP estimate.

**Phase A — Vercel MCP Adapter + auth provider spike (~1 day).** Install `mcp-handler` (Vercel MCP Adapter) and provision **WorkOS AuthKit** via the Vercel Marketplace (default; alternate: Stytch). Stand up a single throwaway `/api/[transport]/route.ts` with `withMcpAuth` and a `verifyToken` that calls WorkOS's JWKS. Build identity-bridging: when a user mints credentials in `/settings/integrations`, TML calls WorkOS's API to ensure their TML `user_id` is the `sub` claim (or a custom claim) on issued tokens. Verify RFC 8707 Resource Indicator support during the spike — the Vercel MCP Adapter's docs don't mention it, so the provider must handle it. The spike is a real day because identity-bridging glue is the load-bearing piece.

**Phase B — Ship signed `llms.txt` URL in parallel (~1 day).** A `themagiclab.app/u/<token>/llms.txt` route returning the user's repertoire/items/recent activity as flat markdown. Users paste that URL into a Claude Project, ChatGPT custom GPT, or Gemini Gem and have read context for every conversation — works on every consumer LLM today, no MCP, no OAuth client config. This is the **fallback for users who never configure MCP** (the majority, for a long time, given client-config friction). It also quietly validates demand telemetry. **Token-security requirements (these convert "a few hours" into a real day)**: tokens must be **rotatable + revocable** by the user (regenerate button invalidates prior token), URL renders **only currently-non-deleted** tricks/items, and **`event_log` excerpts are opt-in** at URL-mint time (event payloads can carry sensitive context like notes/source attribution). Without these, the URL is a long-lived bearer token that gets stored in LLM client history or shared GPT links and can leak.

**Phase C — Domain query layer extraction (~3–4 days).** Currently data access is split between server actions (using `getDb()` and Drizzle, per `src/app/actions.ts`) and PowerSync's raw-SQL upload route (`src/app/api/powersync/batch/route.ts:109` forces `user_id` server-side). Extract `src/lib/repertoire/queries.ts`, `src/lib/collect/queries.ts`, `src/lib/activity/queries.ts` shared by server actions *and* the MCP server, with proper soft-delete handling, branded IDs, and the strict typing CLAUDE.md mandates. **This refactor pays off independently of MCP** — server actions get cleaner, tests get easier — so it's not pure MCP cost.

**Phase D — MCP server itself (~2–3 days).** Use **Vercel's `mcp-handler` package** (the MCP Adapter) for transport — it wraps the official `@modelcontextprotocol/sdk` and exports `withMcpAuth`, saving routing/Streamable HTTP wiring. Implement resources (read) first, then tools (write). Each tool runs through the auth context produced by Phase A's `verifyToken` — same `user_id` flows into the same query layer used by server actions. Every write tool calls `logEventServer` with a `source: 'mcp'` discriminator (extending the existing `source` enum that already includes `client`/`server` per Explore Agent A). Saving roughly half a day vs. hand-rolling the transport against `@modelcontextprotocol/sdk` directly.

**Phase E — Hardening (~1.5 days).** Per-user rate limiting via Vercel WAF (per CLAUDE.md "Platform Preferences" — prefer Vercel-native). Scope design: `read:repertoire`, `write:repertoire`, `read:collect`, `write:collect`, `read:activity` (no `write:activity` — events are system-emitted). Server-only-tables denylist enforced at the query-layer boundary, not just the MCP layer (defense in depth). Postgres RLS enabled on the exposed tables (see Critical Implementation Considerations item 11). Replay tests with a recorded MCP client transcript.

**Phase F — Documentation + telemetry (~1 day).** A `/settings/integrations` page where users mint their MCP config blob (OAuth client metadata or PAT depending on vendor) **and rotate/revoke MCP credentials and signed URL tokens**. Vercel Analytics events: `mcp_session_started`, `mcp_tool_called` (with tool name), `mcp_resource_read`, plus `llms_txt_url_minted`, `llms_txt_url_rotated`, and `llms_txt_url_fetched` for Phase B's own validation signal — six events total. Update `public/llms.txt` to advertise the MCP endpoint URL. Add `docs/features/mcp.md` mirroring `docs/features/activity.md`; regenerate `public/llms-full.txt` via `pnpm docs:generate`.

**Total: ~9–13 working days.** Slightly down from the 10–14 estimate that assumed hand-rolled transport — the Vercel MCP Adapter saves ~half a day in Phase D and reduces operational risk in Phase A. The domain-query extraction (Phase C) remains the largest variable — strict typing, soft-delete, and branded-ID requirements push it toward the upper end.

---

## Critical implementation considerations

These are the easy-to-miss details that determine whether v1 ships well or becomes a regret.

1. **Schema lock-in for disabled modules is the #1 risk.** The temptation to expose `setlists` and `performances` "since the tables are already there" is strong. Resist. Once an MCP resource is published, removing or restructuring it is a breaking change for every user's connected client. Wait until the corresponding Lab module launches — at that point the MCP schema bump can ship with the launch announcement and feel intentional.
2. **Use the existing user-scoping invariant from PowerSync.** `src/app/api/powersync/batch/route.ts:109` already enforces server-side `user_id` overwrite on every write. Replicate this exact pattern in MCP write tools — never trust an MCP-supplied `user_id`. Cross-tenant data leak is the worst-case bug here.
3. **Server-only tables denylist is a hard wall.** `users`, `user_preferences`, `push_subscriptions` (per `scripts/generate-sync.ts:SERVER_ONLY_TABLES`) must be unreachable through any MCP read or tool. Enforce in the query layer (not just the MCP routing layer) so a future tool author can't accidentally bypass it.
4. **Audit every write through `event_log`.** The dual-sink emission rule from CLAUDE.md ("`trackEvent()` for analytics + `logEventServer()` for canonical history — both must be added together") applies to MCP writes too. Add a `source: 'mcp'` value to the event_log source enum (likely a Drizzle migration). Now `RecentActivityCard` shows the user "Claude added 3 tricks at 14:32" — which is a great trust-building UX.
5. **Spec instability planning.** The 2025-11-25 update replaced Dynamic Client Registration with Client ID Metadata Documents ([Stytch on DCR](https://stytch.com/blog/mcp-oauth-dynamic-client-registration/)). Your OAuth vendor choice (Phase A spike) should ideally support both, or be replaceable behind an interface — assume the spec moves again in 6–12 months.
6. **ChatGPT consumer reach is constrained.** Full MCP write is in Developer Mode beta on Business/Enterprise/Edu plans ([InfoQ](https://www.infoq.com/news/2025/10/chat-gpt-mcp/)). A Free/Plus magician installing a TML MCP server in their personal ChatGPT today is not yet a one-click flow. The Phase B signed `llms.txt` URL covers them; assume this gap closes during 2026 but do not block on it.
7. **Don't expose `event_log` writes.** Activity events are *system-emitted* — emitted by the dual-sink rule on every domain mutation. An MCP client should never be able to forge a `user_signed_in` event. Read-only access to the event stream, no write tool.
8. **Soft-delete awareness in resource reads.** Tricks and items use `deletedAt`. MCP reads must respect that filter consistently. Drizzle queries already do; raw SQL paths need explicit predicates.
9. **Rate limiting per user, not per IP.** A user might genuinely have multiple MCP clients (Claude Desktop on laptop + ChatGPT on phone). Vercel WAF supports per-token rate limits via the `Authorization` header — wire that, not naive IP-based.
10. **Document the privacy promise plainly in the settings UI.** "Connecting an MCP client sends your repertoire/collection/activity to that LLM provider during conversations." Most users don't know what MCP does — make the data flow legible at the consent moment. **The same `/settings/integrations` page must surface revocation UX for both MCP credentials and signed `llms.txt` URLs** — one click invalidates a leaked token.
11. **Postgres RLS as defense-in-depth.** Application-level user-id enforcement (item 2) is necessary but not sufficient for a public-facing endpoint speaking to LLMs. Enable Neon-supported Postgres Row-Level Security on every table the MCP server reads or writes (`tricks`, `tags`, `trick_tags`, `items`, `item_tags`, `item_tricks`, `event_log`). One application-level bug then stops at the database boundary instead of leaking cross-tenant. Cheap to add, high payoff. The PowerSync upload path can keep its current pattern (it already enforces `user_id` server-side); RLS becomes the second wall behind it.

---

## Risks to manage

| Risk | Likelihood | Mitigation |
|---|---|---|
| Schema lock-in on disabled-module exposure | High if v1 is greedy | **Hard scope: only enabled modules in v1.** |
| **Neon Auth never exposes the MCP/OAuth Provider plugin** | Medium | Plan does not depend on it — Option A (managed vendor) is the recommended baseline; Option B (self-hosted Better Auth) is the documented fallback. |
| OAuth vendor goes away or changes pricing | Medium | Abstract behind `src/lib/mcp/auth.ts` interface; the MCP SDK transport is vendor-neutral. |
| Spec churn (DCR → CIMD → next thing) | High over 12 months | Vendor selection prioritizes both DCR + CIMD support; verify RFC 8707 in the spike. Budget 1–2 days/year for spec compliance follow-ups. |
| Identity-bridging glue (Neon Auth user_id ↔ vendor identity) drifts | Medium | Stable `user_id` claim in vendor tokens; integration test covering full round-trip; alarm on missing claim at the MCP boundary. |
| Cross-tenant leak via MCP query | Low likelihood, catastrophic impact | Application-level user_id enforcement + Postgres RLS (defense-in-depth) + cross-tenant integration test. |
| Consumer ChatGPT MCP gap leaves users out | High but temporary | Phase B signed `llms.txt` URL covers them; revisit when OpenAI ships consumer MCP. |
| Opportunity cost vs. Lab module completion | Medium | The 10–14 days won't directly grow the data surface. Accept this as a strategic bet on power-user differentiation pre-launch. |
| MCP tool calls overwhelm a free-tier Neon connection pool | Low | Connection pool already exists (`src/app/api/powersync/batch/route.ts:137`); MCP reuses it; add per-user rate limiting. |
| LLM hallucinates malicious tool inputs | Real | Strict Zod validation at every tool boundary (zod is already a dep, `package.json:80`); no "open-ended SQL" tools. |
| Phase B signed URL leaks (pasted into a shared GPT) | Real | Tokens user-rotatable; revocation UX in `/settings/integrations`; opt-in for event_log excerpts; soft-delete-aware rendering. |
| GPL-3.0 license question for downstream forks | Low for the hosted endpoint | GPL-3.0 hosted services do not trigger source-distribution requirements (unlike AGPL). Flag only if downstream forks self-host their own MCP server. |

---

## Test plan

Test runners are already in place — `vitest` (`package.json:112`, `pnpm test`/`test:run`/`test:coverage`), `@playwright/test` (`package.json:84`, `pnpm test:e2e`/`test:e2e:ui`), and `@testing-library/react` (`package.json:88`). Coverage threshold is 80% global per CLAUDE.md.

### Unit tests (Vitest, co-located `*.test.ts`)

- `src/lib/repertoire/queries.test.ts`, `src/lib/collect/queries.test.ts`, `src/lib/activity/queries.test.ts` — every extracted query function. Soft-delete handling, user-scoping, branded-ID coercion. Mock `getDb()` per the existing pattern in `src/features/*/hooks/*.test.ts`.
- `src/lib/mcp/tools/*.test.ts` — every MCP tool (`add_trick`, `update_trick`, `delete_trick`, `tag_trick`, `add_item`, etc.). Assert: rejects invalid `user_id`, rejects forged `event_log` writes, returns expected schema, emits `logEventServer` with `source: 'mcp'`.
- `src/lib/mcp/auth.test.ts` — token verification path: valid token, expired token, wrong audience (RFC 8707 Resource Indicator mismatch), missing scope.
- `src/lib/mcp/scopes.test.ts` — scope enforcement: a `read:repertoire` token cannot call `write:repertoire` tools; a `read:activity` token cannot read `items`.
- `src/lib/mcp/llms-txt.test.ts` — Phase B URL builder: respects soft-delete, respects opt-in for event_log excerpts, regenerating a token invalidates the prior one.

### Integration tests (Vitest with a real test DB or pg-mem; fenced by `pnpm test:run`)

- **Cross-tenant fixture test.** Seed two users with overlapping data shapes; for every read resource and every write tool, assert user A's MCP token cannot reach user B's data. This is the single most important integration test — failure here is a CVE-level bug.
- **Postgres RLS validation.** With RLS enabled (per Critical Implementation Considerations item 11), execute every MCP read/write under a deliberately-mis-scoped session and assert RLS rejects it. Belt-and-suspenders alongside the application-level test above.
- **Audit trail verification.** Every write tool produces an `event_log` row with the right `eventType`, `entityType`, and `source: 'mcp'`. `RecentActivityCard` renders it correctly (component test).
- **Phase B token rotation.** Mint, fetch, regenerate, fetch — second fetch with the old token must 401.

### E2E tests (Playwright, `e2e/*.spec.ts`)

- `e2e/integrations.spec.ts` (new) — happy path: user navigates to `/settings/integrations`, mints an MCP credential, copies the connection URL, clicks "rotate," confirms prior credential is invalidated. Mints a `llms.txt` URL, fetches it, regenerates, confirms 401 on stale URL.
- Extend the existing `e2e/activity.spec.ts` — assert the activity feed shows MCP-emitted events with the correct `source` discriminator.
- Cross-locale check (light): the `/settings/integrations` page renders in `en`, `fr`, and one other locale without missing keys.

### MCP protocol compliance

- Run [`@modelcontextprotocol/inspector`](https://github.com/modelcontextprotocol/inspector) against the local MCP endpoint and verify: `initialize`, `tools/list`, `resources/list`, `tools/call`, `resources/read`, `resources/subscribe` (for `tml://activity/events`).
- Verify OAuth flow against the spec: discovery endpoint, authorization request with PKCE + Resource Indicator, token exchange, token verification, token revocation.

---

## Local dev setup

The project's existing `pnpm dev` runs Next.js with `--experimental-https` (`package.json:22`), which is required because most MCP clients refuse plain HTTP. That's a small but real gift here.

**To develop the MCP server locally:**

1. **Run TML** — `pnpm dev` produces a local HTTPS dev server.
2. **Configure the OAuth vendor for localhost** — most vendors require explicit allowed redirect URIs. Add `https://localhost:3000/api/auth/callback` and the MCP authorization-server callback per the vendor's docs.
3. **Run MCP Inspector** — `npx @modelcontextprotocol/inspector https://localhost:3000/api/mcp` opens a UI for `tools/list` / `resources/list` / `tools/call`. Best feedback loop while iterating on tool definitions.
4. **Connect Claude Desktop to localhost** — add the MCP endpoint to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) pointing at `https://localhost:3000/api/mcp`. Trust the dev cert. Restart Claude Desktop.
5. **For Phase B `llms.txt` URL testing** — mint a token in the local app, then fetch `https://localhost:3000/u/<token>/llms.txt`. Use Claude Project's "add URL" feature with the local URL (works on macOS Claude Desktop).
6. **Database state** — use a Neon dev branch (per memory `reference_neon_branches.md`) so cross-tenant fixture tests don't pollute the main dev DB.

**Pre-commit guards:** Lefthook (`package.json:35`, `prepare: lefthook install`) auto-runs lint + typecheck + sync:check on changed files. Schema changes auto-trigger `pnpm sync:check` per the project's Stop hook (CLAUDE.md "Validation hooks").

---

## All-dimensions checklist

Per CLAUDE.md `.claude/rules/new-feature.md`: "Plans for new features must explicitly cover... Be explicit about dimensions that don't need changes." Each dimension addressed below.

| Dimension | Coverage |
|---|---|
| **Offline-first** | MCP server itself is online-only by definition (LLM clients can't reach it offline). The `/settings/integrations` page must show a meaningful offline state: existing credentials are listed (cached), but mint/rotate buttons are disabled with explanation. PowerSync's offline cache pattern from existing settings pages applies. |
| **Soft-delete** | Required everywhere — every MCP read filters `deletedAt is null`; delete tools soft-delete via the existing pattern; signed `llms.txt` URL only renders non-deleted rows. Tests cover this in unit + integration. |
| **PWA compat** | `/settings/integrations` page works as PWA — no MCP-specific assets need to be added to `public/sw.js` because MCP runs server-side. The signed `llms.txt` URL route does NOT need to be cached by the SW (always fetched fresh). |
| **Next.js 16** | All async dynamic APIs respected — `await params`, `await cookies()`, `await headers()`. New MCP route handlers under `src/app/api/mcp/` use the App Router pattern. Server Actions remain stable; no `experimental.serverActions` flag. React Compiler handles memoization in the settings UI. |
| **PowerSync data serialization** | N/A — MCP server bypasses PowerSync entirely (it talks directly to Neon via Drizzle). PowerSync continues to serve the browser SQLite cache; the two paths share the canonical event_log audit trail. |
| **Mobile-first design** | `/settings/integrations` is mobile-first per CLAUDE.md (<768px → 768–1024px → >1024px). 44×44 touch targets on rotate/copy/revoke buttons. The connection-URL display uses a long-press "copy" pattern on mobile. Bottom-tab nav (existing) shows Settings under "More". |
| **Performance** | MCP tool execution target: <200ms p95 for reads, <500ms p95 for writes. Pool reuse via the existing connection pool (`src/app/api/powersync/batch/route.ts:137`). No N+1: tool implementations batch DB calls. |
| **Accessibility (WCAG)** | `/settings/integrations` follows existing accessibility patterns: semantic HTML, ARIA labels on icon-only buttons (rotate, revoke, copy), keyboard navigation through the credential list, focus management on modal dialogs (revocation confirmation), `motion-safe:` for any reveal animations, screen-reader-friendly success/error toasts via `sonner`. |
| **Strong TS** | Branded IDs (`UserId`, `TrickId`, `TagId`, `ItemId`, `EventId`) on every query/tool boundary. No `any`. Discriminated unions for tool inputs (Zod-derived). Exhaustive switch on the new `event_log.source` enum (`client \| server \| mcp`). |
| **Vercel Analytics events** | Six new events per Phase F: `mcp_session_started`, `mcp_tool_called` (with tool name + result outcome), `mcp_resource_read`, `llms_txt_url_minted`, `llms_txt_url_rotated`, `llms_txt_url_fetched`. Existing dual-sink rule: matched canonical entries in `event_log`. |
| **All 7 locales (de, en, es, fr, it, nl, pt)** | All `/settings/integrations` strings added to `src/i18n/messages/*.json` for every locale. Use the `/i18n` skill to scaffold; CI's `pnpm i18n:check` (project Stop hook) catches missing keys. ICU plural support for "X credentials connected." |
| **Playwright E2E** | `e2e/integrations.spec.ts` (covered in Test plan). Existing `playwright.config.ts` already configured. |
| **CSP** | The MCP endpoint is same-origin so no CSP changes for the response. The `/settings/integrations` page may need a `connect-src` allowance for the OAuth vendor's domain (e.g., `*.stytch.com`). Update `src/lib/csp.ts` and validate via `/real-build-check`. |
| **Security review** | Cross-tenant test (mandatory), Postgres RLS, server-only-tables denylist, rate-limiting, signed-URL token rotation, RFC 8707 Resource Indicator validation, scope enforcement. See Critical Implementation Considerations and Risks tables. |
| **Documentation** | Update `public/llms-full.txt` via `pnpm docs:generate` after the feature ships. Add a `docs/features/mcp.md` that mirrors the structure of `docs/features/activity.md`. |

---

## Verification

How to know the build is right before sharing it with users:

- **Run `/verify` (full suite: lint + typecheck + test:run + sync:check + i18n:check)** before shipping. Project rule from CLAUDE.md.
- **Run `pnpm test:e2e`** to execute the Playwright suite, including the new `e2e/integrations.spec.ts`.
- **Run `pnpm test:coverage`** and confirm 80% global threshold is maintained.
- **Run `pnpm build` and inspect generated CSP** to confirm the new MCP endpoint, Phase B signed-URL route, and OAuth vendor `connect-src` work under production CSP rules. Use `/real-build-check`.
- **Run `pnpm sync:check`** after any schema change (e.g., adding `source: 'mcp'` to `event_log`). Auto-runs in the project Stop hook.
- **Live Claude Desktop install test.** Connect a real Claude Desktop to the production MCP endpoint; run `tools/list`, `resources/list`, a read, and a write; confirm `event_log` records the `source: 'mcp'` entry and `RecentActivityCard` shows it.
- **MCP Inspector probe.** Run `@modelcontextprotocol/inspector` against the production endpoint to validate OAuth flow, scope advertising, and Resource Indicator handling.
- **Privacy/consent UX review.** The `/settings/integrations` consent text reviewed against the data-flow reality. If the user can't tell from the UI what data goes where, the consent isn't valid.
- **Rate-limit smoke test.** Manually flood the endpoint from a single token and confirm Vercel WAF kicks in.
- **Cross-locale spot-check.** Load `/settings/integrations` in all 7 locales (use the `__locale` cookie or query param); confirm no missing keys, no clipped text on mobile widths.

---

## Critical files referenced

- `src/db/schema/` — every table; data-shape source of truth.
- `src/db/schema/event-log.ts` — audit trail substrate; MUST land on `main` before MCP work begins.
- `src/lib/events/` — `logEvent` / `logEventServer` dual-sink emission helpers; MCP writes route through `logEventServer`.
- `src/lib/modules.ts:32-87` — module enabled/disabled flags; the v1-scope decision boundary.
- `src/auth/server.ts` — current cookie/session auth; MCP OAuth lives in a new `src/auth/mcp/` module alongside.
- `src/app/api/powersync/batch/route.ts:109` — the canonical user-scoping invariant pattern; MCP write tools must replicate it.
- `src/sync/synced-columns.ts:SYNCED_TABLE_NAMES` and `scripts/generate-sync.ts:SERVER_ONLY_TABLES` — the synced/server-only split that defines the MCP exposure denylist.
- `src/app/actions.ts`, `src/app/(app)/settings/actions.ts` — pattern for shared query layer extraction (Phase C).
- `package.json:52` — `@neondatabase/auth@0.2.0-beta.1` (Neon Auth = managed Better Auth 1.4.18; key constraint for the auth strategy).
- `package.json:80` — `zod@4.3.6` already installed; reuse for MCP tool input validation.
- `package.json:84,112` — `@playwright/test`, `vitest` already configured; reuse for E2E + unit suites.
- `package.json` (new dependency in Phase D) — `mcp-handler` (Vercel MCP Adapter); WorkOS SDK or Stytch SDK depending on Phase A outcome.
- `next.config.ts` / `vercel.json` — Node serverless runtime; no Edge constraints; no infra refactor needed.
- `public/llms.txt` — the per-user signed-URL extension point for Phase B.
- `src/lib/csp.ts` — CSP builder; OAuth vendor's `connect-src` domain needs to be added.
- `src/lib/analytics.ts` — extend with `mcp_session_started` / `mcp_tool_called` / `mcp_resource_read` / `llms_txt_url_minted` / `llms_txt_url_rotated` / `llms_txt_url_fetched` events.
- `src/i18n/messages/{de,en,es,fr,it,nl,pt}.json` — new keys for the `/settings/integrations` page in all 7 locales.
- `e2e/` — new `e2e/integrations.spec.ts`; existing `e2e/activity.spec.ts` extends to cover MCP-emitted events.
- `playwright.config.ts` — already configured; no changes expected.
- `vitest.setup.ts` — may need extension if mocking the OAuth vendor SDK.

---

## Sources cited (external)

- MCP authorization specification — [modelcontextprotocol.io/specification/draft/basic/authorization](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- 2025-11-25 spec changes (DCR → CIMD, OAuth 2.1 resource server formalization) — [The New MCP Authorization Specification](https://dasroot.net/posts/2026/04/mcp-authorization-specification-oauth-2-1-resource-indicators/)
- Streamable HTTP transport (March 2025) — [Zylos research on MCP's Remote Revolution](https://zylos.ai/research/2026-03-08-mcp-remote-evolution-streamable-http-enterprise-adoption)
- ChatGPT MCP support (Developer Mode beta, B/E/Edu) — [OpenAI help center](https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta), [InfoQ](https://www.infoq.com/news/2025/10/chat-gpt-mcp/), [OpenAI MCP guide](https://developers.openai.com/api/docs/mcp)
- Gemini MCP support (API/SDK + Gemini CLI, March-April 2026) — [Google Cloud blog](https://cloud.google.com/blog/products/ai-machine-learning/announcing-official-mcp-support-for-google-services), [Gemini CLI MCP docs](https://geminicli.com/docs/tools/mcp-server/)
- Forrester 2026 prediction (30% of enterprise app vendors launching MCP servers) — [Truto 2026 SaaS PM guide](https://truto.one/blog/what-is-mcp-model-context-protocol-the-2026-guide-for-saas-pms)
- DCR analysis — [Stytch on MCP OAuth Dynamic Client Registration](https://stytch.com/blog/mcp-oauth-dynamic-client-registration/)
- **Neon Auth = managed Better Auth** — [Neon Auth overview](https://neon.com/docs/auth/overview), [Neon Auth plugin guide](https://neon.com/docs/auth/guides/plugins) (5 supported plugins: Admin, Email OTP, JWT, Organization, Open API).
- **Better Auth MCP plugin** — [better-auth.com/docs/plugins/mcp](https://better-auth.com/docs/plugins/mcp) (NOT supported by managed Neon Auth).
- **Better Auth OAuth Provider plugin** — [better-auth.com/docs/plugins/oauth-provider](https://better-auth.com/docs/plugins/oauth-provider) (PKCE + DCR + introspection + revocation; RFC 8707 not currently in feature list — verify in spike).
- **Neon's MCP-with-Better-Auth-on-Vercel pattern** — [Solving the MCP Authentication Headache with Vercel & Better Auth](https://neon.com/blog/solving-mcp-with-vercel-and-better-auth) (use as reference if Option B / self-hosted Better Auth becomes the chosen path).
- MCP Inspector — [github.com/modelcontextprotocol/inspector](https://github.com/modelcontextprotocol/inspector)
- **Vercel MCP Adapter (`mcp-handler`) with OAuth support** — [Vercel changelog: OAuth support added to MCP Adapter](https://vercel.com/changelog/oauth-support-added-to-mcp-adapter) (BYO-auth via `verifyToken`; integrates with Better Auth, Clerk, Descope, Stytch, WorkOS).
- **WorkOS AuthKit + Vercel MCP template** — [workos.com/blog/vercel-mcp-workos-authkit-template](https://workos.com/blog/vercel-mcp-workos-authkit-template) (recommended Phase A starting point).
- **Stytch + Vercel MCP guide** — [stytch.com/docs/guides/connected-apps/mcp-servers/vercel](https://stytch.com/docs/guides/connected-apps/mcp-servers/vercel) (alternate auth provider).
- **Self-hosted reference implementation** — [raxITai/mcp-oauth-sample](https://github.com/raxITai/mcp-oauth-sample) (Next.js 15 + Postgres + RFC 8707 + PKCE + DCR; useful if Option B is needed).
- **"Sign in with Vercel"** — [vercel.com/docs/sign-in-with-vercel](https://vercel.com/docs/sign-in-with-vercel) — *not applicable here*: this is for letting users log into apps with their Vercel account, not for issuing OAuth tokens for our own users.
