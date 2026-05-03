import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SYNCED_TABLE_NAMES } from "../src/sync/synced-columns";

// Migrations < 21 predate the GRANT discipline introduced by 0020 (issue #245)
// and created tables under the old permissive default ACL — they don't (and
// shouldn't retroactively) carry GRANT lines. Lift this constant only if the
// historical baseline ever shifts.
const ENFORCE_FROM_INDEX = 21;

const MIGRATION_FILENAME_RE = /^(\d{4})_.+\.sql$/;
// Allows an optional schema prefix (`public.tricks`, `"public"."tricks"`); the
// captured group is the bare table name. Without the prefix branch, hand-written
// schema-qualified DDL would silently bypass the check.
const CREATE_TABLE_RE =
  /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?[a-zA-Z_][a-zA-Z0-9_]*"?\s*\.\s*)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
// Captures every `GRANT … ON [TABLE] <targets> TO <grantees>;` in one pass; the
// `(.+?)` target group spans newlines, and the `(?:TABLE\s+)?` skip handles the
// optional `TABLE` keyword. Membership of `authenticated` in the grantee list is
// checked downstream so multi-role lists in any order match correctly.
const GRANT_RE = /GRANT\s+[^;]*?\sON\s+(?:TABLE\s+)?(.+?)\s+TO\s+([^;]+);/gis;
const IDENTIFIER_RE = /"([a-zA-Z_][a-zA-Z0-9_]*)"|([a-zA-Z_][a-zA-Z0-9_]*)/g;
const SECURITY_DEFINER_RE = /\bSECURITY\s+DEFINER\b/i;
// Catches `REVOKE ... EXECUTE ... FROM ...;` in any of the supported shapes
// (`ON FUNCTION foo()`, `ON ALL FUNCTIONS IN SCHEMA public`, `ALL PRIVILEGES`).
const REVOKE_EXECUTE_RE =
  /REVOKE\s+[^;]*?\bEXECUTE\b[^;]*?\bFROM\s+([^;]+);/gis;
// Captures `CREATE [OR REPLACE] FUNCTION [<schema>.]<name>`. Optional schema is
// group 1; bare function name is group 2. Capturing the schema lets the caller
// scope SECURITY DEFINER attribution to schema `public` only — which is the sole
// scope of the migrations.md §4 rule. A `CREATE FUNCTION other.foo …` is out of
// scope (different schema, not subject to the lockdown discipline).
const CREATE_FUNCTION_NAME_RE =
  /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s*\.\s*)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
// Captures `REVOKE [EXECUTE|ALL [PRIVILEGES]] ON FUNCTION [<schema>.]<name>[(<args>)] FROM <list>;`.
// Schema is group 1 (optional); function name is group 2; FROM grantee list is
// group 3. The argument signature is optional — PostgreSQL accepts the bare
// form `ON FUNCTION foo FROM …;` when the name is unambiguous. The `[^)]*`
// inside the parens stays on one signature.
const REVOKE_NAMED_FUNCTION_RE =
  /REVOKE\s+(?:EXECUTE|ALL(?:\s+PRIVILEGES)?)\s+ON\s+FUNCTION\s+(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s*\.\s*)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s*(?:\([^)]*\))?\s+FROM\s+([^;]+);/gis;
// Captures `REVOKE [EXECUTE|ALL [PRIVILEGES]] ON ALL FUNCTIONS IN SCHEMA public FROM <list>;`.
// Schema is anchored to `public` (the sole scope of the rule) so a sweep over
// a different schema cannot credit a public-schema definer function. FROM
// grantee list is group 1.
const REVOKE_ALL_FUNCTIONS_RE =
  /REVOKE\s+(?:EXECUTE|ALL(?:\s+PRIVILEGES)?)\s+ON\s+ALL\s+FUNCTIONS\s+IN\s+SCHEMA\s+"?public"?\s+FROM\s+([^;]+);/gis;

// True when `schema` is undefined (unqualified — defaults to `public` under the
// search_path used by these migrations) or literally `public`. Used to scope
// SECURITY DEFINER attribution and named-REVOKE coverage to the public schema —
// the sole scope of the migrations.md §4 rule.
function isPublicSchema(schema: string | undefined): boolean {
  return schema === undefined || schema.toLowerCase() === "public";
}

type Failure = {
  readonly file: string;
  readonly subject: string;
  readonly message: string;
};

// Strips line comments (`-- … <eol>`) and block comments (`/* … */`) so that
// regex matches operate only on real SQL — a commented-out GRANT must not
// satisfy the check, and a comment that mentions `CREATE TABLE` must not
// trigger a false positive.
//
// Accepted limitation: not string-literal aware. A `--` or `/* */` sequence
// inside a `'…'` string literal (including dynamic SQL embedded in a
// `DO $$ … $$;` body via `EXECUTE '…'`) is stripped as if it were a comment.
// In practice DDL migrations don't bury comment-like text in literals, and
// the only failure mode is over-stripping (which can suppress a real GRANT
// or CREATE TABLE token that lives inside a literal — not a real-world
// pattern in this tree). Tightening to a full PG tokenizer is a larger lift
// than this static check warrants.
function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

function parseGrantTargets(target: string): readonly string[] {
  const names: string[] = [];
  for (const match of target.matchAll(IDENTIFIER_RE)) {
    const name = match[1] ?? match[2];
    if (name) {
      names.push(name);
    }
  }
  return names;
}

// Splits a `TO ...;` grantee list (e.g. `authenticated, "neondb_owner"`) into a
// normalized array of identifiers, lowercase and unquoted.
function parseGrantees(grantees: string): readonly string[] {
  return grantees
    .split(",")
    .map((g) => g.trim().replace(/^"|"$/g, "").toLowerCase());
}

function findCreatedSyncedTables(
  sql: string,
  syncedTables: ReadonlySet<string>
): ReadonlySet<string> {
  const created = new Set<string>();
  for (const match of sql.matchAll(CREATE_TABLE_RE)) {
    const name = match[1];
    if (name && syncedTables.has(name)) {
      created.add(name);
    }
  }
  return created;
}

function findGrantedToAuthenticated(sql: string): ReadonlySet<string> {
  const granted = new Set<string>();
  for (const match of sql.matchAll(GRANT_RE)) {
    const targets = match[1] ?? "";
    const grantees = parseGrantees(match[2] ?? "");
    if (!grantees.includes("authenticated")) {
      continue;
    }
    for (const name of parseGrantTargets(targets)) {
      granted.add(name);
    }
  }
  return granted;
}

// Returns the names of `CREATE FUNCTION`s declared with `SECURITY DEFINER` in
// `sql`. Each CREATE FUNCTION match defines a span (this match.index → next
// match.index, or EOF for the last); SECURITY DEFINER appearing in a span is
// attributed to that function. Out-of-CREATE SECURITY DEFINER (e.g.,
// `ALTER FUNCTION foo() SECURITY DEFINER`) only triggers the `<function>`
// sentinel fallback when no CREATE FUNCTION exists in the file — if a
// CREATE FUNCTION's span happens to enclose an ALTER FUNCTION's keyword,
// attribution lands on the CREATE'd function (accepted limitation; no such
// migration exists in tree today).
function findSecurityDefinerFunctionNames(sql: string): readonly string[] {
  const matches = [...sql.matchAll(CREATE_FUNCTION_NAME_RE)];
  const names: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const schema = match?.[1];
    const name = match?.[2];
    const start = match?.index;
    if (!name || start === undefined || !isPublicSchema(schema)) {
      continue;
    }
    const end = matches[i + 1]?.index ?? sql.length;
    if (SECURITY_DEFINER_RE.test(sql.slice(start, end))) {
      names.push(name);
    }
  }
  return names;
}

type RevokeCoverage = {
  readonly broadSweepGrantees: ReadonlySet<string>;
  readonly namedFunctionGrantees: ReadonlyMap<string, ReadonlySet<string>>;
};

// Aggregates REVOKE EXECUTE coverage in one pass. Broad-sweep REVOKEs
// (`ON ALL FUNCTIONS IN SCHEMA …`) apply to every function; named REVOKEs
// (`ON FUNCTION foo(…)`) apply to that one function only. Two named REVOKEs
// for the same function (e.g., FROM PUBLIC + FROM authenticated) merge into
// one grantee set. `REVOKE ALL [PRIVILEGES]` forms are treated as covering
// EXECUTE since they revoke a superset.
function analyzeRevokeExecute(sql: string): RevokeCoverage {
  const broad = new Set<string>();
  for (const match of sql.matchAll(REVOKE_ALL_FUNCTIONS_RE)) {
    for (const g of parseGrantees(match[1] ?? "")) {
      broad.add(g);
    }
  }
  const named = new Map<string, Set<string>>();
  for (const match of sql.matchAll(REVOKE_NAMED_FUNCTION_RE)) {
    const schema = match[1];
    const name = match[2];
    if (!(name && isPublicSchema(schema))) {
      continue;
    }
    let set = named.get(name);
    if (!set) {
      set = new Set();
      named.set(name, set);
    }
    for (const g of parseGrantees(match[3] ?? "")) {
      set.add(g);
    }
  }
  return { broadSweepGrantees: broad, namedFunctionGrantees: named };
}

// Per-function pairing check (issue #253, .claude/rules/migrations.md §4): each
// SECURITY DEFINER function MUST be paired with a REVOKE EXECUTE that covers
// both PUBLIC and authenticated. A function is covered if either:
//   1. A broad-sweep REVOKE (`ON ALL FUNCTIONS IN SCHEMA …`) covers both
//      grantees in this file, or
//   2. A named REVOKE for that function — combined with any broad-sweep
//      grantees — covers both PUBLIC and authenticated.
// `CREATE FUNCTION` auto-grants EXECUTE to PUBLIC, and `authenticated`
// inherits via PUBLIC; missing the pair lets `authenticated` invoke the
// definer function and bypass RLS + column GRANTs.
function findFunctionsWithMissingRevoke(
  sql: string,
  definerNames: readonly string[]
): readonly string[] {
  if (definerNames.length === 0) {
    return [];
  }
  const { broadSweepGrantees, namedFunctionGrantees } =
    analyzeRevokeExecute(sql);
  if (
    broadSweepGrantees.has("public") &&
    broadSweepGrantees.has("authenticated")
  ) {
    return [];
  }
  const missing: string[] = [];
  for (const name of definerNames) {
    const grantees = new Set(broadSweepGrantees);
    const fnGrantees = namedFunctionGrantees.get(name);
    if (fnGrantees) {
      for (const g of fnGrantees) {
        grantees.add(g);
      }
    }
    if (!(grantees.has("public") && grantees.has("authenticated"))) {
      missing.push(name);
    }
  }
  return missing;
}

// Non-global detector for `CREATE [OR REPLACE] FUNCTION` — used to classify a
// statement as a function declaration without mutating regex state.
const CREATE_FUNCTION_DETECT_RE = /\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/i;
// Anchored detector for a dollar-quote opener at the current cursor position
// (`$$` or `$tag$`). Hot path inside `splitTopLevelStatements`, which is why
// it lives at module scope rather than inline.
const DOLLAR_QUOTE_OPEN_RE = /^\$([a-zA-Z_][a-zA-Z0-9_]*)?\$/;

// Splits SQL into top-level statements at `;`, respecting dollar-quoted bodies
// (`$$ … $$`, `$tag$ … $tag$`). String literals (`'…'`) are not handled
// specially — DDL migrations don't typically contain semicolons inside string
// literals, and a stray `';'` would only over-split, never under-split. Used by
// `hasOrphanSecurityDefiner` to determine whether a SECURITY DEFINER mention
// sits inside a CREATE FUNCTION declaration (shielded) or outside any (orphan).
function splitTopLevelStatements(sql: string): readonly string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;
  let dollarTag: string | null = null;
  while (i < sql.length) {
    if (dollarTag === null) {
      const open = DOLLAR_QUOTE_OPEN_RE.exec(sql.slice(i));
      if (open) {
        dollarTag = open[1] ?? "";
        current += open[0];
        i += open[0].length;
        continue;
      }
      if (sql[i] === ";") {
        statements.push(`${current};`);
        current = "";
        i++;
        continue;
      }
      current += sql[i];
      i++;
    } else {
      const close = `$${dollarTag}$`;
      if (sql.startsWith(close, i)) {
        current += close;
        i += close.length;
        dollarTag = null;
        continue;
      }
      current += sql[i];
      i++;
    }
  }
  if (current.trim() !== "") {
    statements.push(current);
  }
  return statements;
}

// True when any top-level statement contains SECURITY DEFINER outside a
// CREATE FUNCTION declaration (e.g., `ALTER FUNCTION foo() SECURITY DEFINER;`,
// or `CREATE PROCEDURE … SECURITY DEFINER`). This is the trigger for the
// `<function>` sentinel fallback. Statement-level scoping (vs the previous
// span-tiling approach) blocks two regressions: (a) a non-public CREATE
// FUNCTION's "span" silently shielding a real public-schema orphan SD via
// span-extension to EOF, and (b) SD inside a non-public CREATE FUNCTION body
// being treated as orphan because schema-filtered span definition leaves the
// body uncovered. Accepted limitation (symmetric to F-A's): a DO block whose
// body literally contains the text "SECURITY DEFINER" (e.g., dynamic SQL like
// `EXECUTE 'CREATE FUNCTION … SECURITY DEFINER …'`) would flag as orphan
// here. Zero such migrations exist in tree; tightening would require
// statement-introspection inside dollar-quoted bodies.
function hasOrphanSecurityDefiner(sql: string): boolean {
  for (const stmt of splitTopLevelStatements(sql)) {
    if (
      SECURITY_DEFINER_RE.test(stmt) &&
      !CREATE_FUNCTION_DETECT_RE.test(stmt)
    ) {
      return true;
    }
  }
  return false;
}

// Coarse fallback: when SECURITY DEFINER appears outside any CREATE FUNCTION
// (e.g., `ALTER FUNCTION foo() SECURITY DEFINER`), the per-function pairing
// can't attribute the keyword to a specific name. This file-level check at
// least asserts that some REVOKE EXECUTE covering both PUBLIC and authenticated
// exists somewhere in the file.
function hasRevokeExecuteFromPublicAndAuthenticated(sql: string): boolean {
  let foundPublic = false;
  let foundAuthenticated = false;
  for (const match of sql.matchAll(REVOKE_EXECUTE_RE)) {
    const grantees = parseGrantees(match[1] ?? "");
    if (grantees.includes("public")) {
      foundPublic = true;
    }
    if (grantees.includes("authenticated")) {
      foundAuthenticated = true;
    }
  }
  return foundPublic && foundAuthenticated;
}

function checkMigrationFile(
  filename: string,
  rawSql: string,
  syncedTables: ReadonlySet<string>
): readonly Failure[] {
  const sql = stripSqlComments(rawSql);
  const failures: Failure[] = [];

  const created = findCreatedSyncedTables(sql, syncedTables);
  if (created.size > 0) {
    const granted = findGrantedToAuthenticated(sql);
    for (const table of created) {
      if (!granted.has(table)) {
        failures.push({
          file: filename,
          subject: table,
          message: `${filename}: synced table "${table}" was created without a matching \`GRANT … TO authenticated;\` in the same migration. Since 0020, schema \`public\` has no default privileges for \`authenticated\` — add an explicit GRANT in this migration. See .claude/rules/migrations.md §3.`,
        });
      }
    }
  }

  if (SECURITY_DEFINER_RE.test(sql)) {
    // Per-function pairing for SECURITY DEFINER functions in schema `public`
    // (the sole scope of the rule). Non-public-schema definer functions are
    // out of scope and produce zero entries here.
    for (const fn of findFunctionsWithMissingRevoke(
      sql,
      findSecurityDefinerFunctionNames(sql)
    )) {
      failures.push({
        file: filename,
        subject: fn,
        message: `${filename}: SECURITY DEFINER function "${fn}" declared without a matching \`REVOKE EXECUTE ON FUNCTION ${fn}(...) FROM PUBLIC, authenticated;\` (or broad-sweep \`REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, authenticated;\`) in the same migration. \`CREATE FUNCTION\` grants EXECUTE to PUBLIC by default and \`authenticated\` inherits via PUBLIC — bypassing RLS and column GRANTs. See .claude/rules/migrations.md §4.`,
      });
    }
    // Orphan SECURITY DEFINER (outside any CREATE FUNCTION span — e.g.,
    // `ALTER FUNCTION foo() SECURITY DEFINER`). The script can't pair this
    // to a CREATE'd function name, so it falls back to the coarse file-level
    // REVOKE check + `<function>` sentinel.
    if (
      hasOrphanSecurityDefiner(sql) &&
      !hasRevokeExecuteFromPublicAndAuthenticated(sql)
    ) {
      failures.push({
        file: filename,
        subject: "<function>",
        message: `${filename}: SECURITY DEFINER appears outside any CREATE FUNCTION declaration this script can identify. Add a per-function \`REVOKE EXECUTE … FROM PUBLIC, authenticated;\` (or a broad-sweep \`REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, authenticated;\`) in the same migration. See .claude/rules/migrations.md §4.`,
      });
    }
  }

  return failures;
}

function listEnforcedMigrations(
  migrationsDir: string,
  enforceFromIndex: number
): readonly string[] {
  const matches: string[] = [];
  for (const file of readdirSync(migrationsDir)) {
    const match = file.match(MIGRATION_FILENAME_RE);
    if (!match) {
      continue;
    }
    const idx = Number.parseInt(match[1] ?? "", 10);
    if (Number.isFinite(idx) && idx >= enforceFromIndex) {
      matches.push(file);
    }
  }
  return matches.sort();
}

type CheckOptions = {
  readonly syncedTables?: ReadonlySet<string>;
  readonly enforceFromIndex?: number;
};

function checkMigrationsDir(
  migrationsDir: string,
  options: CheckOptions = {}
): readonly Failure[] {
  const synced = options.syncedTables ?? new Set<string>(SYNCED_TABLE_NAMES);
  const enforceFromIndex = options.enforceFromIndex ?? ENFORCE_FROM_INDEX;
  const files = listEnforcedMigrations(migrationsDir, enforceFromIndex);
  const failures: Failure[] = [];
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    failures.push(...checkMigrationFile(file, sql, synced));
  }
  return failures;
}

function main(): void {
  const projectRoot = join(import.meta.dirname, "..");
  const migrationsDir = join(projectRoot, "src", "db", "migrations");
  const failures = checkMigrationsDir(migrationsDir);

  if (failures.length > 0) {
    console.error("Synced-table GRANT discipline check failed:");
    for (const failure of failures) {
      console.error(`  - ${failure.message}`);
    }
    process.exit(1);
  }

  console.log("Synced-table GRANT discipline check passed.");
}

export type { CheckOptions, Failure };
export {
  checkMigrationFile,
  checkMigrationsDir,
  findCreatedSyncedTables,
  findGrantedToAuthenticated,
  hasRevokeExecuteFromPublicAndAuthenticated,
  listEnforcedMigrations,
  parseGrantees,
  parseGrantTargets,
  stripSqlComments,
};

const invokedDirectly =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  main();
}
