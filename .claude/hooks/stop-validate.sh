#!/usr/bin/env bash
# stop-validate.sh — path-aware Stop hook.
#
# Runs cheap validators only when the working tree shows relevant changes.
# Blocks Claude from declaring "done" (exit 2) when concrete drift is detected.
# Silent (exit 0) when nothing needs checking, so doc-only turns aren't penalized.
#
# Triggers:
#   - src/db/schema/**            → pnpm sync:check
#   - src/i18n/messages/*.json    → pnpm i18n:check
#   - src/db/migrations/meta/_journal.json → monotonicity check

# NOTE: `set -e` is intentionally NOT enabled — we rely on explicit `||` and
# if-blocks so validator failures surface via append_error rather than abort.
# Do not add `-e` without auditing every command substitution below.
set -u -o pipefail

# Private per-user log dir (not world-writable /tmp). Falls back to mktemp if
# $HOME is unset or $HOME/.cache isn't writable.
log_dir="${HOME:-/tmp}/.cache/claude-hooks"
if ! mkdir -p "$log_dir" 2>/dev/null; then
  log_dir="$(mktemp -d -t claude-stop.XXXXXX)"
  trap 'rm -rf "$log_dir"' EXIT
fi
chmod 700 "$log_dir" 2>/dev/null || true

payload="$(cat 2>/dev/null || true)"
# Empty payload means stdin was closed or Claude Code didn't pipe one. Fall
# open rather than run validators — prevents infinite re-entry if the
# loop-guard detection fails.
[ -z "$payload" ] && exit 0

# Break infinite loops when the hook itself re-enters Stop. Prefer a real JSON
# parse when jq is available; fall back to substring match when it isn't. On
# parse failure or empty output, fall open (exit 0).
if command -v jq >/dev/null 2>&1; then
  active="$(printf '%s' "$payload" | jq -r '.stop_hook_active // false' 2>/dev/null || echo parse_error)"
  case "$active" in
    true) exit 0 ;;
    ""|parse_error)
      echo "⚠ stop-validate: could not parse hook payload — exiting silently to avoid loop" >&2
      exit 0 ;;
  esac
else
  case "$payload" in
    *'"stop_hook_active"'*[Tt]rue*) exit 0 ;;
  esac
fi

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -z "$repo_root" ] && exit 0
cd "$repo_root" || {
  echo "⚠ stop-validate: cd to $repo_root failed — exiting silently" >&2
  exit 0
}

# Use NUL-delimited git status so filenames with spaces/newlines/quotes are
# handled correctly and rename entries ("RM new\0old\0") are split cleanly.
changed_records=()
while IFS= read -r -d '' entry; do
  changed_records+=("$entry")
done < <(git status -z 2>/dev/null)
[ ${#changed_records[@]} -eq 0 ] && exit 0

needs_sync=0
needs_i18n=0
needs_journal=0
needs_typecheck=0

# Helper: classify a path against the watched buckets.
classify_path() {
  case "$1" in
    src/db/schema/*) needs_sync=1 ;;
    src/i18n/messages/*.json) needs_i18n=1 ;;
    src/db/migrations/meta/_journal.json) needs_journal=1 ;;
  esac
  # Typecheck on any non-test, non-script .ts / .tsx change. Tests run via
  # vitest separately; scripts/ is tsx-executed, not part of the app build.
  case "$1" in
    *.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx) ;;
    scripts/*) ;;
    *.ts|*.tsx) needs_typecheck=1 ;;
  esac
}

# For renames/copies (R*/C*), the current record holds the NEW path and the
# next record holds the OLD path — consume both.
i=0
while [ $i -lt ${#changed_records[@]} ]; do
  entry="${changed_records[$i]}"
  status="${entry:0:2}"
  path="${entry:3}"
  classify_path "$path"
  # For renames/copies, the OLD path is in the next record. Match it too so
  # `git mv src/db/schema/foo.ts src/lib/foo.ts` (rename OUT of watched dir)
  # still triggers the sync check.
  case "$status" in
    R*|C*)
      if [ $((i + 1)) -lt ${#changed_records[@]} ]; then
        classify_path "${changed_records[$((i + 1))]}"
      fi
      i=$((i + 1))
      ;;
  esac
  i=$((i + 1))
done

if [ $needs_sync -eq 0 ] && [ $needs_i18n -eq 0 ] && [ $needs_journal -eq 0 ] && [ $needs_typecheck -eq 0 ]; then
  exit 0
fi

errors=""

append_error() {
  if [ -z "$errors" ]; then
    errors="$1"
  else
    errors="$errors
$1"
  fi
}

# Scrub obvious secret patterns from log output before echoing to Claude's
# transcript. Defense-in-depth — the scripts being tailed shouldn't log
# secrets, but if they do, don't leak into the model context.
scrub_secrets() {
  sed -E \
    -e 's#(postgres(ql)?|mysql|mariadb|redis|amqp)://[^[:space:]]+#<redacted-uri>#g' \
    -e 's#[[:alnum:]_]*(TOKEN|SECRET|KEY|PASSWORD|PASSWD)[[:alnum:]_]*=[^[:space:]]+#<redacted-env>#g' \
    -e 's#(AKIA[0-9A-Z]{16}|sk_live_[a-zA-Z0-9]{20,}|sk-ant-[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9]{36}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})#<redacted-secret>#g'
}

log_tail_block() {
  local log="$1"
  if [ -s "$log" ]; then
    append_error "  Log tail:"
    append_error "$(tail -n 15 "$log" 2>/dev/null | scrub_secrets | sed 's/^/    /')"
  else
    append_error "  (no output captured — re-run the command manually to see the error)"
  fi
}

if [ $needs_sync -eq 1 ]; then
  sync_log="$log_dir/sync.log"
  if ! pnpm sync:check >"$sync_log" 2>&1; then
    append_error "✗ pnpm sync:check failed — sync artifacts drift from src/db/schema/. Run: pnpm sync:generate"
    log_tail_block "$sync_log"
  fi
fi

if [ $needs_i18n -eq 1 ]; then
  i18n_log="$log_dir/i18n.log"
  if ! pnpm i18n:check >"$i18n_log" 2>&1; then
    append_error "✗ pnpm i18n:check failed — locale key parity broken. Add missing keys across all 7 locales."
    log_tail_block "$i18n_log"
  fi
fi

if [ $needs_typecheck -eq 1 ]; then
  typecheck_log="$log_dir/typecheck.log"
  if ! pnpm typecheck >"$typecheck_log" 2>&1; then
    append_error "✗ pnpm typecheck failed — fix type errors before declaring done."
    log_tail_block "$typecheck_log"
  fi
fi

if [ $needs_journal -eq 1 ] && [ -f src/db/migrations/meta/_journal.json ]; then
  if ! command -v node >/dev/null 2>&1; then
    append_error "⚠ migration journal check skipped — node not on PATH (install Node 24.x)."
  else
    journal_log="$log_dir/journal.log"
    # Exit codes: 0 = ok, 1 = ordering bug, 2+ = parse/infra error.
    node -e '
      try {
        const fs = require("fs");
        const j = JSON.parse(fs.readFileSync("src/db/migrations/meta/_journal.json", "utf8"));
        let prev = 0;
        for (const e of j.entries || []) {
          if (typeof e.when !== "number" || e.when <= prev) {
            console.error(`entry idx=${e.idx} tag=${e.tag} when=${e.when} not > previous ${prev}`);
            process.exit(1);
          }
          prev = e.when;
        }
      } catch (err) {
        console.error(`parse error: ${err.message}`);
        process.exit(2);
      }
    ' >"$journal_log" 2>&1
    status=$?
    case $status in
      0) : ;;
      1)
        append_error "✗ migration journal timestamps are not monotonically increasing — drizzle-orm silently skips out-of-order entries."
        if [ -s "$journal_log" ]; then
          append_error "$(cat "$journal_log" 2>/dev/null | scrub_secrets | sed 's/^/  /')"
        fi
        ;;
      *)
        append_error "⚠ migration journal check errored (not an ordering bug — parse/infra issue, exit $status):"
        if [ -s "$journal_log" ]; then
          append_error "$(cat "$journal_log" 2>/dev/null | scrub_secrets | sed 's/^/  /')"
        fi
        ;;
    esac
  fi
fi

if [ -n "$errors" ]; then
  {
    echo "Stop-hook validation blocked the completion. Fix the following before declaring done:"
    echo
    echo "$errors"
    echo
    echo "(See CLAUDE.md → 'Verify Before Cite' for the full anti-hallucination protocol.)"
  } >&2
  exit 2
fi

exit 0
