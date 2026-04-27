#!/usr/bin/env bash
# edit-nudges.sh — PostToolUse hook for Write|Edit.
#
# 1. Runs Ultracite auto-fix on the edited file — and surfaces failures
#    rather than swallowing them (old behavior silently masked real errors).
# 2. Emits path-aware advisories on edits to high-risk areas (schema, i18n,
#    migrations, CSP, service worker) so Claude is nudged about downstream
#    steps at the moment of edit.
#
# Exits 2 with stderr when a nudge applies. PostToolUse treats exit 2 as
# non-blocking feedback appended to Claude's context.

# NOTE: `set -e` is intentionally NOT enabled — we rely on explicit `||` and
# if-blocks. Do not add `-e` without auditing every command substitution below.
set -u -o pipefail

log_dir="${HOME:-/tmp}/.cache/claude-hooks"
if ! mkdir -p "$log_dir" 2>/dev/null; then
  log_dir="$(mktemp -d -t claude-edit.XXXXXX)"
  trap 'rm -rf "$log_dir"' EXIT
fi
chmod 700 "$log_dir" 2>/dev/null || true

payload="$(cat 2>/dev/null || true)"

# Hard requirement: jq must be present to parse the hook payload. A missing jq
# previously silently disabled the entire hook — surface it once on stderr.
if ! command -v jq >/dev/null 2>&1; then
  echo "⚠ edit-nudges: jq not installed — hook disabled. Install with: brew install jq" >&2
  exit 0
fi

file="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty')"
[ -z "$file" ] && exit 0
[ ! -f "$file" ] && exit 0
# Reject symlinks: the downstream repo-root prefix check is string-based, so
# a symlink under the repo pointing outside it would bypass the scope guard.
[ -L "$file" ] && exit 0

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -z "$repo_root" ] && exit 0

# Only touch files within this repo — don't run Ultracite on arbitrary absolute
# paths (e.g., if Claude edits ~/.ssh/config the hook must no-op).
case "$file" in
  "$repo_root"/*) rel="${file#"$repo_root"/}" ;;
  *) exit 0 ;;
esac

# Skip generated artifacts and lock files — Ultracite shouldn't touch them and
# no advisory could apply. Cheaper than going through the full nudge pipeline.
case "$rel" in
  pnpm-lock.yaml|src/sync/schema.ts|src/sync/synced-columns.ts|powersync/sync-config.yaml|public/llms.txt|public/llms-full.txt)
    exit 0
    ;;
esac

nudges=""

append_nudge() {
  if [ -z "$nudges" ]; then
    nudges="$1"
  else
    nudges="$nudges

$1"
  fi
}

# Ultracite auto-fix on the edited file — capture output so a genuine failure
# is surfaced to Claude rather than silently swallowed.
ultracite_log="$log_dir/ultracite.log"
pnpm exec ultracite fix -- "$file" >"$ultracite_log" 2>&1
ultracite_status=$?
if [ $ultracite_status -ne 0 ] && [ -s "$ultracite_log" ]; then
  append_nudge "⚠ pnpm exec ultracite fix failed on $rel (exit $ultracite_status):
$(tail -n 5 "$ultracite_log" 2>/dev/null | sed 's/^/   /')"
fi

case "$rel" in
  src/db/schema/*)
    append_nudge "📎 Schema edit detected. Downstream steps:
   1. pnpm db:generate       (generate SQL migration)
   2. review src/db/migrations/*.sql
   3. pnpm db:migrate        (apply to Neon)
   4. pnpm sync:generate     (refresh PowerSync artifacts — REQUIRED; pre-commit + CI gate)
   5. pnpm docs:generate     (if docs reference the schema)
   Or invoke the /migrations skill to run the full workflow.
   Memory: feedback_migration_single_file.md, feedback_migration_timestamps.md."
    ;;
esac

case "$rel" in
  src/i18n/messages/*.json)
    append_nudge "📎 Translation file edit detected. All 7 locales must share matching keys:
   en · fr · es · pt · it · de · nl
   Verify with: pnpm i18n:check"
    ;;
esac

case "$rel" in
  src/db/migrations/meta/_journal.json)
    if ! command -v node >/dev/null 2>&1; then
      append_nudge "⚠ Migration journal check skipped — node not on PATH (install Node 24.x)."
    else
      journal_log="$log_dir/edit-journal.log"
      node -e '
        try {
          const fs = require("fs");
          const j = JSON.parse(fs.readFileSync("src/db/migrations/meta/_journal.json", "utf8"));
          let prev = 0;
          for (const e of j.entries || []) {
            if (typeof e.when !== "number" || e.when <= prev) {
              console.error(`idx=${e.idx} tag=${e.tag} when=${e.when} not > previous ${prev}`);
              process.exit(1);
            }
            prev = e.when;
          }
        } catch (err) {
          console.error(`parse error: ${err.message}`);
          process.exit(2);
        }
      ' >"$journal_log" 2>&1
      journal_status=$?
      case $journal_status in
        0) : ;;
        1)
          append_nudge "❌ Migration journal timestamps NOT monotonically increasing — drizzle will silently skip out-of-order entries:
$(cat "$journal_log" 2>/dev/null | sed 's/^/   /')
   Fix the 'when' value before running pnpm db:migrate.
   Memory: feedback_migration_timestamps.md."
          ;;
        *)
          append_nudge "⚠ Migration journal check errored (not an ordering bug — parse/infra issue, exit $journal_status):
$(cat "$journal_log" 2>/dev/null | sed 's/^/   /')"
          ;;
      esac
    fi
    ;;
esac

case "$rel" in
  src/db/migrations/*.sql)
    append_nudge "📎 SQL migration edit detected:
   • Dependent DDL must stay in the SAME file (Neon serverless runs each file in isolation — later DDL can't see earlier column additions from a separate file).
   • _journal.json 'when' must be strictly increasing.
   Memory: feedback_migration_single_file.md, feedback_migration_timestamps.md."
    ;;
esac

case "$rel" in
  src/lib/csp.ts)
    append_nudge "📎 CSP edit detected. For hash-based or HTML-dependent changes, run 'pnpm build' and inspect the actual rendered output — source-level reasoning has missed production realities in the past.
   Memory: feedback_verify_against_real_build.md."
    ;;
esac

case "$rel" in
  public/sw.js)
    append_nudge "📎 Service worker edit detected. Offline-first is a core requirement — verify:
   • PowerSync WASM + workers under /@powersync/ are still cached for offline boot.
   • shouldBypass() skips only live API traffic (sync/auth/analytics), never static assets.
   Memory: project_offline_first.md."
    ;;
esac

case "$rel" in
  next.config.ts)
    append_nudge "📎 next.config.ts edit detected. Run 'pnpm build' to confirm config parses:
   • reactCompiler / devIndicators / serverActions go top-level — NOT under 'experimental'.
   • Proxy config exports must NOT use 'as const' (Turbopack can't statically parse it).
   • CLAUDE.md → Version-Specific Rules → Next.js 16."
    ;;
esac

case "$rel" in
  package.json)
    append_nudge "📎 package.json edit detected:
   • Run 'pnpm install' to update pnpm-lock.yaml.
   • Before adding a new dep, check it's not already covered: 'radix-ui' (umbrella, not @radix-ui/react-*), 'react-email' (top-level, not @react-email/components), 'resend', 'sonner', 'cmdk', '@hookform/resolvers', 'culori', 'web-push', '@vercel/firewall', '@journeyapps/wa-sqlite' are easy to miss.
   • CLAUDE.md → Verify Before Cite (Library availability)."
    ;;
esac

case "$rel" in
  src/proxy.ts)
    append_nudge "📎 proxy.ts edit detected. Confirm with 'pnpm build', not just 'pnpm dev':
   • Proxy config export must NOT use 'as const' — Turbopack can't statically parse it.
   • This is Next.js 16's middleware replacement; never rename to middleware.ts."
    ;;
esac

case "$rel" in
  drizzle.config.ts)
    append_nudge "📎 drizzle.config.ts edit detected:
   • Confirm schema/migration paths still resolve.
   • Run 'pnpm db:generate' to test codegen with the updated config.
   • Schema-related rules: .claude/rules/migrations.md."
    ;;
esac

case "$rel" in
  biome.json)
    append_nudge "📎 biome.json edit detected. Rule-set drift can silently mask issues:
   • Run 'pnpm lint' to surface any new errors.
   • Project extends 'ultracite/biome/core' and 'ultracite/biome/next' — keep these in 'extends'."
    ;;
esac

case "$rel" in
  vitest.config.mts|vitest.setup.ts)
    append_nudge "📎 Vitest config edit detected:
   • Run 'pnpm test:run' to confirm the config still parses and tests still pass.
   • Coverage threshold is 80% global — enforce or relax intentionally."
    ;;
esac

case "$rel" in
  lefthook.yml)
    append_nudge "📎 lefthook.yml edit detected:
   • Run 'pnpm exec lefthook install' to refresh git hooks.
   • Test by staging a sample file (e.g. 'git add CLAUDE.md && git commit -m test --dry-run')."
    ;;
esac

case "$rel" in
  .github/workflows/*.yml|.github/workflows/*.yaml)
    append_nudge "📎 GitHub Actions workflow edit detected. CI/CD changes are not validated locally:
   • Push to a draft PR to dry-run the workflow.
   • Audit GITHUB_TOKEN permissions and any new secrets/variables.
   • If sync-deploy.yml: confirm POWERSYNC_* vars/secrets unchanged."
    ;;
esac

if [ -n "$nudges" ]; then
  printf '%s\n' "$nudges" >&2
  exit 2
fi

exit 0
