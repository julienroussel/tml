# The Magic Lab — Product Overview

**Tagline**: Train. Plan. Perform. Elevate your magic.

The Magic Lab (themagiclab.app) is a free, open-source, offline-first workspace built for magicians. It is a single place to organize your repertoire, plan setlists, track practice and performance, and grow your craft over time — not a marketplace, not a social network, not a video platform. Your data stays yours.

## Who it is for

Working magicians, hobbyists, and students of the art — from someone learning their first sleights to a touring professional juggling close-up, parlor, and stage repertoire across multiple venues. If you currently keep your tricks in a notebook, a Notes app, a spreadsheet, or scattered Notion pages, The Magic Lab is purpose-built for what you are doing.

The app is designed mobile-first because rehearsal and reference happen in greenrooms, at tables, on planes — not at a desk. It installs as a Progressive Web App on iOS and Android and works fully offline once loaded.

## What it does today

The current product surface ships two complete modules, plus an activity history. Several other modules are in development and visible as "coming soon" placeholders.

### Available today

- **Repertoire** — Catalog your tricks. Each entry tracks name, description, category (card, coin, mentalism, stage, etc.), effect type (vanish, production, prediction…), difficulty (1–5), status (new / learning / performance-ready / mastered / shelved), props required, music, languages performed in, angle sensitivity, camera-friendliness, source (book, DVD, mentor), video reference, and free-form notes. Tag tricks to slice your library however you think (themes, opener, closer, walkaround, restaurant set, etc.).
- **Collection** — Inventory of props, books, gimmicks, DVDs, downloads, decks, clothing, consumables, accessories. Track condition, purchase date and price, current location ("close-up case", "stage case"), quantity, and link items back to the tricks that use them — so you can answer "which tricks am I out of supplies for?" or "where did I put the Invisible Deck?".
- **Activity** — A canonical timeline of everything you've done in the app: trick added / updated / deleted, item added, tag created, settings changed. Useful as a journal and as a "did I really practice this week?" reality check.

### In development (visible but disabled)

- **Improve** — Log practice sessions (what, how long, self-rating), see trends, maintain streaks.
- **Train** — Goals, drills, structured practice plans.
- **Plan** — Build show-ready setlists. Order tricks, annotate transitions, estimate timing, keep multiple setlists for different venues and audiences.
- **Perform** — Performance log: venue, audience, what worked, what to change, feedback.
- **Enhance** — Insights and suggestions: what to practice next, gaps in repertoire, suggested setlists from your existing tricks.

These appear in the navigation as "coming soon" today; they will activate as they ship.

## How it is different

- **Built for magicians, by a magician.** The data model knows what a "trick" is, what "angle sensitivity" means, why "camera friendly" matters, what tags actually need to do. A general notes app does not.
- **Offline-first, not cloud-only.** Your data is stored locally on your device in a real database (SQLite via PowerSync) and syncs to the cloud (Neon Postgres) when you are online. Open the app backstage with no signal — every trick, every note, every prop entry is right there. Make changes offline, they sync next time you connect.
- **Free and open source under the GPL-3.0 license.** No paid tiers, no ads, no upsells, no "pro plan". The code is on [GitHub](https://github.com/julienroussel/tml). You can read it, fork it, self-host it, or contribute.
- **Privacy stance.** The app collects the minimum needed (email + display name from your OAuth provider, plus the data you choose to put in). Data is encrypted in transit and at rest. We do not sell, share, or use your data for advertising. Anonymous analytics (page views, performance metrics) help us improve the app. No third-party AI providers see your data.
- **Mobile-first PWA.** Installable on iOS and Android home screens. Works as a native-feeling app — no app store, no auto-updates breaking things, no platform tax.
- **Internationalized.** Available in English, French, Spanish, Portuguese, Italian, German, and Dutch.

## Compared to alternatives

- **vs. a paper notebook**: searchable, filterable, syncs across devices, never lost, never water-damaged. The notebook is still better for ad-hoc sketches; The Magic Lab is better for everything else.
- **vs. a Notes app (Apple Notes / Google Keep)**: structured fields per trick, tags that mean something, linkable inventory, practice/performance history. Notes apps are unstructured prose; magic has structure.
- **vs. Notion / Obsidian / Airtable**: zero setup. You do not build the schema, you do not maintain templates, you do not invent the data model — it already knows what a trick is. Specialized beats general-purpose when the domain has its own shape.
- **vs. SaaS competitors**: free, open source, offline-first, no lock-in. Export your data any time.

## Project facts

- **License**: GPL-3.0
- **Source**: https://github.com/julienroussel/tml
- **Production URL**: https://themagiclab.app
- **Languages supported**: English, French, Spanish, Portuguese, Italian, German, Dutch
- **Hosting**: Vercel
- **Stack**: Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui, Neon Postgres, PowerSync, Drizzle ORM, next-intl. (See the architecture sections of this document for engineering detail.)
- **Status**: Active development. Repertoire, Collection, and Activity are production-ready. Improve, Train, Plan, Perform, and Enhance are visible as upcoming modules.
