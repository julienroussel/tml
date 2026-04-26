---
description: Explain why a file/path looks the way it does — git history + relevant memory entries
allowed-tools: Bash(git log:*), Bash(git blame:*), Bash(grep:*), Bash(ls:*), Read
---

Explain why `$ARGUMENTS` (a file path or directory) looks the way it does. Use this for "why does this exist?" / "what's the history here?" questions before suggesting changes.

Run in parallel:

1. `git log --oneline -n 8 -- $ARGUMENTS` — last 8 commits touching the path.
2. `git log -n 3 --format='%h %s%n%b' -- $ARGUMENTS` — full bodies of the last 3 commits (gives "why").
3. `grep -l -F "$ARGUMENTS" ~/.claude/projects/-Users-jroussel-dev-tml/memory/*.md` — memory entries that reference the path; `Read` and inline any matches.

Report:

- **Recent commits** (oneline list).
- **Top 3 commit messages** (full body, trimmed).
- **Relevant memory entries** (full bodies if any, otherwise "no matching memory").
- **One-sentence synthesis**: "This file was last touched on `<date>` to `<reason>`; relevant prior context: `<memory pointer>` or `none`."

Do not propose changes — only explain.
