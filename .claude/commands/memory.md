---
description: Search project memory files for a topic and print matching entries inline
allowed-tools: Bash(grep:*), Bash(ls:*), Bash(find:*), Read
---

Search the project's auto-memory directory (`~/.claude/projects/-Users-jroussel-dev-tml/memory/`) for entries matching `$ARGUMENTS` and print the matching files inline with their bodies.

Use this when:
- You half-remember a prior decision and want to confirm before acting.
- You're starting a focused task (migrations, CSP, sync) and want the relevant memory subset without re-reading the whole index.
- The user references prior context ("we decided X earlier", "didn't we hit this before?").

Steps:

1. List all memory files: `ls ~/.claude/projects/-Users-jroussel-dev-tml/memory/*.md`.
2. `grep -l -i "$ARGUMENTS" ~/.claude/projects/-Users-jroussel-dev-tml/memory/*.md` to find matches in either filename or body.
3. For each matching file, `Read` it and print its content under a header `### <filename>`.
4. End with a one-line summary: `Found N matching memory entries for "$ARGUMENTS"`.

If no matches: print `No memory entries match "$ARGUMENTS". Either it's not yet captured or use a broader term (e.g., "migration" instead of "drizzle").`

Do not modify any memory files from this command — search and print only.
