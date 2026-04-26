---
description: Run pnpm build and surface actual rendered HTML/RSC output for CSP and SSR work
allowed-tools: Bash(pnpm build:*), Bash(find .next:*), Bash(ls .next:*), Bash(grep -c:*), Bash(wc -l:*), Bash(wc -c:*), Read, Grep
---

Run a real production build and surface the actual rendered output. Use this before planning any change that depends on the structure of production HTML — CSP hashes, inline scripts, meta tags, SSR shape. Source-level reasoning has missed production realities in the past (memory: `feedback_verify_against_real_build.md`).

Steps:

1. Run `pnpm build` — capture status.
2. On success, report:
   - Prerendered routes: `find .next/server/app -name '*.html' -maxdepth 4` (trim if long)
   - Inline scripts in a representative page: `grep -c '<script>' .next/server/app/**/*.html` (pick one representative page and show its inline script count)
   - Asset count: `find .next/static -type f | wc -l`
3. If the user is asking about a specific route or CSP concern, print the first 8KB of the relevant rendered HTML so inline `<script>`, `<meta>`, and CSP-relevant elements are visible (use `head -c 8000 <path>`).
4. For CSP work: enumerate every `<script>` tag (inline and external). Report inline count + external sources.

Do not guess or summarize HTML shape from source — only report what the build actually emits.

$ARGUMENTS
