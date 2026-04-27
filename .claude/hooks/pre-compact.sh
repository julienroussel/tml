#!/usr/bin/env bash
# pre-compact.sh — capture in-flight intent before context compaction.
#
# Writes the last user messages + a timestamp to the project's auto-memory at
# `in_flight.md`. The post-compact session can read this file to resume cleanly.
# `MEMORY.md` carries a one-line pointer so Claude finds it.
#
# Fires on both `manual` and `auto` PreCompact events.
#
# Failure philosophy: loud to stderr, but always exit 0 — PreCompact must not
# block compaction. Mirrors edit-nudges.sh.

set -u -o pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "⚠ pre-compact: jq not installed — in-flight capture disabled. Install with: brew install jq" >&2
  exit 0
fi

if ! payload="$(cat 2>/dev/null)"; then
  echo "⚠ pre-compact: failed to read stdin" >&2
  exit 0
fi
if [ -z "$payload" ]; then
  echo "⚠ pre-compact: empty payload (hook expects PreCompact JSON on stdin)" >&2
  exit 0
fi

# Single jq pass — surfaces parse errors instead of letting three independent
# pipelines silently produce empty strings on a malformed payload. Joins fields
# with ASCII unit separator (\x1f) — a non-whitespace char that `read` won't
# collapse, so a missing leading field stays empty instead of being eaten.
parse_err="$(mktemp)"
parsed="$(printf '%s' "$payload" | jq -rj '[.transcript_path // "", .trigger // "unknown", .cwd // ""] | join("")' 2>"$parse_err")"
parse_status=$?
if [ $parse_status -ne 0 ]; then
  echo "⚠ pre-compact: payload parse failed (exit $parse_status):" >&2
  sed 's/^/   /' "$parse_err" >&2
  rm -f "$parse_err"
  exit 0
fi
rm -f "$parse_err"
IFS=$'\x1f' read -r transcript_path trigger cwd <<<"$parsed"

if [ -z "$transcript_path" ]; then
  echo "⚠ pre-compact: payload missing .transcript_path — capture skipped" >&2
  exit 0
fi
if [ ! -r "$transcript_path" ]; then
  echo "⚠ pre-compact: transcript not readable at $transcript_path" >&2
  exit 0
fi

# Locate the auto-memory directory. Falls back to a derived path if the env var
# is absent (which it usually is — auto-memory dir lives under ~/.claude/projects).
memory_dir="${CLAUDE_AUTO_MEMORY_DIR:-}"
if [ -z "$memory_dir" ]; then
  if [ -z "$cwd" ]; then
    echo "⚠ pre-compact: payload missing .cwd and CLAUDE_AUTO_MEMORY_DIR unset — cannot locate memory dir" >&2
    exit 0
  fi
  # Auto-memory mirrors git toplevel. Split the cd/git-rev-parse pair so a
  # cd-success-but-rev-parse-failure (no .git, dubious-ownership rejection)
  # surfaces instead of silently falling back to a sub-path slug.
  if ! toplevel="$(cd "$cwd" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null)"; then
    echo "⚠ pre-compact: could not resolve git toplevel for $cwd — capture skipped" >&2
    exit 0
  fi
  # Auto-memory naming: replace each '/' with '-' (the leading '/' becomes the
  # leading '-' — do NOT add a second prefix or you get '--Users-...').
  slug="$(printf '%s' "$toplevel" | sed 's:/:-:g')"
  # Defense-in-depth: reject slugs containing path-traversal or whitespace
  # before interpolating into a write path.
  case "$slug" in
    *..*|*$'\n'*|*$'\t'*)
      echo "⚠ pre-compact: derived slug rejected ($slug)" >&2
      exit 0
      ;;
  esac
  memory_dir="$HOME/.claude/projects/${slug}/memory"
fi

if ! mkdir -p "$memory_dir" 2>/dev/null; then
  echo "⚠ pre-compact: failed to create memory dir at $memory_dir" >&2
  exit 0
fi

out="$memory_dir/in_flight.md"
ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Pull the last 5 actual user messages (text content; skip tool_result blocks
# which are also stored as `type: user` records). One jq pass over the JSONL
# stream — collect all matching messages into an array, slice last 5, join
# with a clear separator so multi-line messages stay grouped.
jq_err="$(mktemp)"
last_user_raw="$(
  jq -rn '
    [inputs
     | select(.type == "user" and .message? != null)
     | .message.content as $c
     | (if ($c | type) == "string" then $c
        elif ($c | type) == "array" then ($c | map(select(.type? == "text") | .text) | join("\n"))
        else "" end) as $text
     | select($text != "")
     | $text]
    | .[-5:]
    | join("\n\n--- next message ---\n\n")
  ' "$transcript_path" 2>"$jq_err"
)"
jq_status=$?

if [ $jq_status -ne 0 ]; then
  err_excerpt="$(head -c 500 "$jq_err" 2>/dev/null || true)"
  echo "⚠ pre-compact: jq failed reading $transcript_path (exit $jq_status):" >&2
  printf '%s\n' "$err_excerpt" | sed 's/^/   /' >&2
  last_user="    (capture failed — see stderr)"
elif [ -z "$last_user_raw" ]; then
  last_user="    (no user messages found)"
else
  last_user="$(printf '%s' "$last_user_raw" | sed 's/^/    /')"
fi
rm -f "$jq_err"

if ! cat >"$out" <<EOF
---
name: In-flight context (last compaction)
description: Captured by PreCompact hook so the post-compact session can resume cleanly
type: project
---

**Compacted at:** $ts ($trigger)

## Last user messages

\`\`\`
$last_user
\`\`\`

**To resume:** read this file on session start, plus any unfinished tasks via TaskList.
EOF
then
  echo "⚠ pre-compact: failed to write $out" >&2
  exit 0
fi

exit 0
