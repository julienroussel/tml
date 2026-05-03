import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  checkMigrationFile,
  checkMigrationsDir,
  findCreatedSyncedTables,
  findGrantedToAuthenticated,
  hasRevokeExecuteFromPublicAndAuthenticated,
  listEnforcedMigrations,
  parseGrantees,
  parseGrantTargets,
  stripSqlComments,
} from "./check-grants";

const SYNCED = new Set<string>(["tricks", "setlists", "event_log", "tags"]);

describe("stripSqlComments", () => {
  it("removes line comments through end-of-line", () => {
    const sql = `CREATE TABLE "tricks" (id uuid); -- with comment\nGRANT SELECT ON "tricks" TO authenticated;`;
    const out = stripSqlComments(sql);
    expect(out).not.toContain("with comment");
    expect(out).toContain('CREATE TABLE "tricks"');
    expect(out).toContain("GRANT SELECT");
  });

  it("removes block comments including across newlines", () => {
    const sql = `/* leading\nblock\ncomment */\nCREATE TABLE "tricks" (id uuid);`;
    const out = stripSqlComments(sql);
    expect(out).not.toContain("leading");
    expect(out).not.toContain("block");
    expect(out).toContain('CREATE TABLE "tricks"');
  });

  it("does not strip non-comment text inside dollar-quoted bodies", () => {
    // Documents the actual behavior — stripSqlComments is not dollar-quote
    // aware. A body free of comment markers passes through unchanged. A `--`
    // or `/* */` inside a body would still be stripped (known limitation; the
    // check accepts the false-negative tradeoff because real migrations don't
    // bury GRANTs inside function bodies).
    const sql = `DO $$ BEGIN GRANT SELECT ON "tricks" TO authenticated; END $$;`;
    expect(stripSqlComments(sql)).toContain("GRANT SELECT");
  });
});

describe("parseGrantTargets", () => {
  it("extracts a single quoted identifier", () => {
    expect(parseGrantTargets('"tricks"')).toEqual(["tricks"]);
  });

  it("extracts a single unquoted identifier", () => {
    expect(parseGrantTargets("tricks")).toEqual(["tricks"]);
  });

  it("extracts multiple comma-separated identifiers across newlines", () => {
    const target = `
      "tricks", "setlists",
      "event_log"
    `;
    expect(parseGrantTargets(target)).toEqual([
      "tricks",
      "setlists",
      "event_log",
    ]);
  });

  it("extracts both schema and table from schema-qualified target", () => {
    // Pinning current behavior: IDENTIFIER_RE walks every identifier, so the
    // schema name appears alongside the table. The check ignores unknown names
    // (not in SYNCED_TABLE_NAMES), so the membership semantic works regardless.
    expect(parseGrantTargets("public.event_log")).toEqual([
      "public",
      "event_log",
    ]);
  });
});

describe("parseGrantees", () => {
  it("normalizes case and strips quotes", () => {
    expect(parseGrantees('AUTHENTICATED, "Foo"')).toEqual([
      "authenticated",
      "foo",
    ]);
  });
});

describe("findCreatedSyncedTables", () => {
  it("returns synced tables present in CREATE TABLE statements", () => {
    const sql = `
      CREATE TABLE "tricks" (id uuid PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS "setlists" (id uuid PRIMARY KEY);
    `;
    expect([...findCreatedSyncedTables(sql, SYNCED)]).toEqual([
      "tricks",
      "setlists",
    ]);
  });

  it("matches unquoted CREATE TABLE identifiers", () => {
    const sql = "CREATE TABLE tricks (id uuid PRIMARY KEY);";
    expect([...findCreatedSyncedTables(sql, SYNCED)]).toEqual(["tricks"]);
  });

  it("captures the table from schema-qualified CREATE TABLE", () => {
    const sql = `
      CREATE TABLE public.tricks (id uuid PRIMARY KEY);
      CREATE TABLE "public"."setlists" (id uuid PRIMARY KEY);
    `;
    expect([...findCreatedSyncedTables(sql, SYNCED)]).toEqual([
      "tricks",
      "setlists",
    ]);
  });

  it("ignores non-synced tables (e.g., server-only)", () => {
    const sql = `CREATE TABLE "users" (id uuid PRIMARY KEY);`;
    expect([...findCreatedSyncedTables(sql, SYNCED)]).toEqual([]);
  });
});

describe("findGrantedToAuthenticated", () => {
  it("captures a single-table GRANT", () => {
    const sql = `GRANT SELECT, INSERT ON "tricks" TO authenticated;`;
    expect([...findGrantedToAuthenticated(sql)]).toEqual(["tricks"]);
  });

  it("captures multi-table multi-line GRANT", () => {
    const sql = `
      GRANT SELECT, INSERT, UPDATE, DELETE ON
        "tricks", "setlists",
        "tags"
      TO authenticated;
    `;
    expect([...findGrantedToAuthenticated(sql)].sort()).toEqual([
      "setlists",
      "tags",
      "tricks",
    ]);
  });

  it("captures column-scoped GRANTs (event_log audit pattern)", () => {
    const sql = `
      GRANT SELECT, INSERT ON "event_log" TO authenticated;
      GRANT UPDATE ("deleted_at", "updated_at") ON "event_log" TO authenticated;
    `;
    expect([...findGrantedToAuthenticated(sql)]).toEqual(["event_log"]);
  });

  it("captures GRANT with the optional TABLE keyword", () => {
    const sql = `GRANT SELECT ON TABLE "tricks" TO authenticated;`;
    expect([...findGrantedToAuthenticated(sql)]).toEqual(["tricks"]);
  });

  it("matches multi-grantee GRANT regardless of authenticated position", () => {
    const trailing = `GRANT SELECT ON "tricks" TO authenticated, viewer;`;
    expect([...findGrantedToAuthenticated(trailing)]).toEqual(["tricks"]);
    const leading = `GRANT SELECT ON "setlists" TO viewer, authenticated;`;
    expect([...findGrantedToAuthenticated(leading)]).toEqual(["setlists"]);
  });

  it("does not match REVOKE statements", () => {
    const sql = `REVOKE ALL ON TABLE "tricks" FROM authenticated;`;
    expect([...findGrantedToAuthenticated(sql)]).toEqual([]);
  });

  it("does not match GRANT to other roles only", () => {
    const sql = `GRANT SELECT ON "tricks" TO neondb_owner;`;
    expect([...findGrantedToAuthenticated(sql)]).toEqual([]);
  });
});

describe("hasRevokeExecuteFromPublicAndAuthenticated", () => {
  it("matches a combined REVOKE FROM PUBLIC, authenticated", () => {
    const sql = "REVOKE EXECUTE ON FUNCTION foo() FROM PUBLIC, authenticated;";
    expect(hasRevokeExecuteFromPublicAndAuthenticated(sql)).toBe(true);
  });

  it("matches two separate REVOKE statements covering both roles", () => {
    const sql = `
      REVOKE EXECUTE ON FUNCTION foo() FROM PUBLIC;
      REVOKE EXECUTE ON FUNCTION foo() FROM authenticated;
    `;
    expect(hasRevokeExecuteFromPublicAndAuthenticated(sql)).toBe(true);
  });

  it("matches REVOKE EXECUTE ON ALL FUNCTIONS form", () => {
    const sql = `
      REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
      REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;
    `;
    expect(hasRevokeExecuteFromPublicAndAuthenticated(sql)).toBe(true);
  });

  it("returns false when only PUBLIC is revoked", () => {
    const sql = "REVOKE EXECUTE ON FUNCTION foo() FROM PUBLIC;";
    expect(hasRevokeExecuteFromPublicAndAuthenticated(sql)).toBe(false);
  });

  it("returns false when only authenticated is revoked", () => {
    const sql = "REVOKE EXECUTE ON FUNCTION foo() FROM authenticated;";
    expect(hasRevokeExecuteFromPublicAndAuthenticated(sql)).toBe(false);
  });
});

describe("checkMigrationFile", () => {
  it("reports failure when a synced table is created without a GRANT", () => {
    const sql = `CREATE TABLE "tricks" (id uuid PRIMARY KEY);`;
    const failures = checkMigrationFile("0021_test.sql", sql, SYNCED);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.subject).toBe("tricks");
    expect(failures[0]?.file).toBe("0021_test.sql");
    expect(failures[0]?.message).toContain("0021_test.sql");
    expect(failures[0]?.message).toContain('"tricks"');
    expect(failures[0]?.message).toContain(".claude/rules/migrations.md §3");
  });

  it("passes when a single-table GRANT covers the new table", () => {
    const sql = `
      CREATE TABLE "tricks" (id uuid PRIMARY KEY);
      GRANT SELECT, INSERT, UPDATE, DELETE ON "tricks" TO authenticated;
    `;
    expect(checkMigrationFile("0021_test.sql", sql, SYNCED)).toEqual([]);
  });

  it("passes when a multi-table GRANT covers all created synced tables", () => {
    const sql = `
      CREATE TABLE "tricks" (id uuid PRIMARY KEY);
      CREATE TABLE "setlists" (id uuid PRIMARY KEY);
      GRANT SELECT, INSERT, UPDATE, DELETE ON
        "tricks", "setlists"
      TO authenticated;
    `;
    expect(checkMigrationFile("0021_test.sql", sql, SYNCED)).toEqual([]);
  });

  it("passes for the event_log column-scoped GRANT pattern", () => {
    const sql = `
      CREATE TABLE "event_log" (id uuid PRIMARY KEY);
      GRANT SELECT, INSERT ON "event_log" TO authenticated;
      GRANT UPDATE ("deleted_at", "updated_at") ON "event_log" TO authenticated;
    `;
    expect(checkMigrationFile("0021_test.sql", sql, SYNCED)).toEqual([]);
  });

  it("passes for schema-qualified CREATE TABLE with matching schema-qualified GRANT", () => {
    const sql = `
      CREATE TABLE public.tricks (id uuid PRIMARY KEY);
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.tricks TO authenticated;
    `;
    expect(checkMigrationFile("0021_test.sql", sql, SYNCED)).toEqual([]);
  });

  it("passes when GRANT lists authenticated alongside other grantees", () => {
    const sql = `
      CREATE TABLE "tricks" (id uuid PRIMARY KEY);
      GRANT SELECT ON "tricks" TO authenticated, neondb_owner;
    `;
    expect(checkMigrationFile("0021_test.sql", sql, SYNCED)).toEqual([]);
  });

  it("ignores a commented-out GRANT (line comment)", () => {
    // F1 regression guard — a `-- GRANT ...` line MUST NOT satisfy the check.
    const sql = `
      CREATE TABLE "tricks" (id uuid PRIMARY KEY);
      -- GRANT SELECT ON "tricks" TO authenticated;
    `;
    const failures = checkMigrationFile("0021_test.sql", sql, SYNCED);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.subject).toBe("tricks");
  });

  it("ignores a commented-out GRANT (block comment)", () => {
    const sql = `
      CREATE TABLE "setlists" (id uuid PRIMARY KEY);
      /* GRANT SELECT ON "setlists" TO authenticated; */
    `;
    const failures = checkMigrationFile("0021_test.sql", sql, SYNCED);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.subject).toBe("setlists");
  });

  it("ignores a commented-out CREATE TABLE", () => {
    // Symmetrical to the above — a comment that mentions CREATE TABLE must
    // not be treated as a real CREATE TABLE.
    const sql = `
      -- CREATE TABLE "tricks" (id uuid PRIMARY KEY);
      /* CREATE TABLE "setlists" (id uuid PRIMARY KEY); */
    `;
    expect(checkMigrationFile("0021_test.sql", sql, SYNCED)).toEqual([]);
  });

  it("ignores non-synced (server-only) tables created without GRANT", () => {
    const sql = `CREATE TABLE "users" (id uuid PRIMARY KEY);`;
    expect(checkMigrationFile("0021_test.sql", sql, SYNCED)).toEqual([]);
  });

  it("fails when a GRANT exists but targets a different table than the one created", () => {
    const sql = `
      CREATE TABLE "tricks" (id uuid PRIMARY KEY);
      GRANT SELECT, INSERT, UPDATE, DELETE ON "setlists" TO authenticated;
    `;
    const failures = checkMigrationFile("0021_test.sql", sql, SYNCED);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.subject).toBe("tricks");
  });

  it("reports one failure per ungranted synced table when multiple are created", () => {
    const sql = `
      CREATE TABLE "tricks" (id uuid PRIMARY KEY);
      CREATE TABLE "setlists" (id uuid PRIMARY KEY);
      GRANT SELECT ON "tricks" TO authenticated;
    `;
    const failures = checkMigrationFile("0021_test.sql", sql, SYNCED);
    expect(failures.map((f) => f.subject)).toEqual(["setlists"]);
  });

  it("flags SECURITY DEFINER function without REVOKE EXECUTE FROM PUBLIC, authenticated", () => {
    const sql = `
      CREATE FUNCTION foo() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;
    `;
    const failures = checkMigrationFile("0021_test.sql", sql, SYNCED);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.subject).toContain("foo");
    expect(failures[0]?.message).toContain("SECURITY DEFINER");
    expect(failures[0]?.message).toContain(".claude/rules/migrations.md §4");
  });

  it("flags SECURITY DEFINER function with only PUBLIC revoked", () => {
    const sql = `
      CREATE FUNCTION foo() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;
      REVOKE EXECUTE ON FUNCTION foo() FROM PUBLIC;
    `;
    const failures = checkMigrationFile("0021_test.sql", sql, SYNCED);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.message).toContain("SECURITY DEFINER");
  });

  it("passes SECURITY DEFINER function with bare-name REVOKE (no signature)", () => {
    // PostgreSQL accepts `REVOKE EXECUTE ON FUNCTION foo FROM …;` without
    // parens when the function name is unambiguous. The pairing must still
    // recognize coverage for that form.
    const sql = `
      CREATE FUNCTION foo() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;
      REVOKE EXECUTE ON FUNCTION foo FROM PUBLIC, authenticated;
    `;
    expect(checkMigrationFile("0021_test.sql", sql, SYNCED)).toEqual([]);
  });

  it("passes SECURITY DEFINER function with combined REVOKE", () => {
    const sql = `
      CREATE FUNCTION foo() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;
      REVOKE EXECUTE ON FUNCTION foo() FROM PUBLIC, authenticated;
    `;
    expect(checkMigrationFile("0021_test.sql", sql, SYNCED)).toEqual([]);
  });

  it("ignores SECURITY DEFINER mentioned only in comments", () => {
    // A prose mention of SECURITY DEFINER in a header comment must not
    // trigger the check (the strip-comments pass clears it before scanning).
    const sql = `
      -- This migration discusses SECURITY DEFINER as a concept.
      ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
        REVOKE ALL ON SEQUENCES FROM authenticated;
    `;
    expect(checkMigrationFile("0021_test.sql", sql, SYNCED)).toEqual([]);
  });

  it("does not flag SECURITY DEFINER on non-synced-related migrations", () => {
    // No CREATE FUNCTION → no SECURITY DEFINER mention in real SQL → no failure.
    const sql = `
      ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
        REVOKE ALL ON FUNCTIONS FROM authenticated;
    `;
    expect(checkMigrationFile("0021_test.sql", sql, SYNCED)).toEqual([]);
  });

  it("flags only the unpaired SECURITY DEFINER function when one of two has a REVOKE", () => {
    // F1 per-function pairing — a REVOKE for foo() does NOT cover bar(). The
    // file-level coarse check would have falsely passed this case.
    const sql = `
      CREATE FUNCTION foo() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;
      CREATE FUNCTION bar() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 2 $$;
      REVOKE EXECUTE ON FUNCTION foo() FROM PUBLIC, authenticated;
    `;
    const failures = checkMigrationFile("0021_test.sql", sql, SYNCED);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.subject).toBe("bar");
    expect(failures[0]?.message).toContain('"bar"');
  });

  it("flags both unpaired SECURITY DEFINER functions with separate failures", () => {
    // F1 — multi-function should yield one failure per missing pairing, not a
    // joined `foo, bar` subject.
    const sql = `
      CREATE FUNCTION foo() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;
      CREATE FUNCTION bar() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 2 $$;
    `;
    const failures = checkMigrationFile("0021_test.sql", sql, SYNCED);
    expect(failures).toHaveLength(2);
    expect(failures.map((f) => f.subject).sort()).toEqual(["bar", "foo"]);
  });

  it("ignores invoker-rights functions when paired with a SECURITY DEFINER", () => {
    // Mixed file: only the SECURITY DEFINER function should be checked. The
    // invoker-rights one is exempt from the pairing requirement.
    const sql = `
      CREATE FUNCTION definer_fn() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;
      CREATE FUNCTION invoker_fn() RETURNS int LANGUAGE sql AS $$ SELECT 2 $$;
      REVOKE EXECUTE ON FUNCTION definer_fn() FROM PUBLIC, authenticated;
    `;
    expect(checkMigrationFile("0021_test.sql", sql, SYNCED)).toEqual([]);
  });

  it("passes SECURITY DEFINER functions covered by a broad-sweep ALL FUNCTIONS REVOKE", () => {
    // F1 — the broad-sweep `REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA …` form
    // covers every function in that schema for the listed grantees.
    const sql = `
      CREATE FUNCTION foo() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;
      CREATE FUNCTION bar() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 2 $$;
      REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, authenticated;
    `;
    expect(checkMigrationFile("0021_test.sql", sql, SYNCED)).toEqual([]);
  });

  it("treats two separate broad-sweep REVOKEs (one per grantee) as combined coverage", () => {
    const sql = `
      CREATE FUNCTION foo() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;
      REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
      REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;
    `;
    expect(checkMigrationFile("0021_test.sql", sql, SYNCED)).toEqual([]);
  });

  it("combines a partial broad-sweep with a named REVOKE to cover a function", () => {
    // Hybrid: the broad sweep gets PUBLIC, the named REVOKE gets authenticated.
    // Together they cover foo().
    const sql = `
      CREATE FUNCTION foo() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;
      REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
      REVOKE EXECUTE ON FUNCTION foo() FROM authenticated;
    `;
    expect(checkMigrationFile("0021_test.sql", sql, SYNCED)).toEqual([]);
  });

  it("falls back to <function> sentinel when SECURITY DEFINER appears outside CREATE FUNCTION", () => {
    // ALTER FUNCTION ... SECURITY DEFINER promotes an existing function. The
    // CREATE_FUNCTION_NAME_RE doesn't match ALTER, so the per-function pairing
    // can't attribute the keyword to a name — fall back to the coarse check
    // and a `<function>` sentinel subject.
    const sql = "ALTER FUNCTION old_fn() SECURITY DEFINER;";
    const failures = checkMigrationFile("0021_test.sql", sql, SYNCED);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.subject).toBe("<function>");
    expect(failures[0]?.message).toContain("SECURITY DEFINER");
    expect(failures[0]?.message).toContain(".claude/rules/migrations.md §4");
  });

  it("does not use sentinel when the coarse fallback REVOKE is satisfied", () => {
    // Same ALTER FUNCTION scenario but a file-level REVOKE covers both
    // grantees — fallback path is satisfied, no failure.
    const sql = `
      ALTER FUNCTION old_fn() SECURITY DEFINER;
      REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, authenticated;
    `;
    expect(checkMigrationFile("0021_test.sql", sql, SYNCED)).toEqual([]);
  });

  it("rejects a named REVOKE on a non-public schema for a public-schema definer", () => {
    // F-A — bare-name keying without schema enforcement let `audit.foo` REVOKE
    // satisfy a `public.foo` definer. The pairing must require schema match.
    const sql = `
      CREATE FUNCTION public.foo() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;
      REVOKE EXECUTE ON FUNCTION audit.foo() FROM PUBLIC, authenticated;
    `;
    const failures = checkMigrationFile("0021_test.sql", sql, SYNCED);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.subject).toBe("foo");
  });

  it("rejects a broad-sweep REVOKE on a non-public schema for a public-schema definer", () => {
    // F-A — `IN SCHEMA <other>` broad sweeps must not credit public-schema
    // definer functions. The rule's scope is schema `public` only.
    const sql = `
      CREATE FUNCTION public.foo() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;
      REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA other_schema FROM PUBLIC, authenticated;
    `;
    const failures = checkMigrationFile("0021_test.sql", sql, SYNCED);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.subject).toBe("foo");
  });

  it("matches schema-qualified CREATE FUNCTION with schema-qualified REVOKE", () => {
    // F-A — both sides reference public explicitly; pairing is satisfied.
    const sql = `
      CREATE FUNCTION public.foo() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;
      REVOKE EXECUTE ON FUNCTION public.foo() FROM PUBLIC, authenticated;
    `;
    expect(checkMigrationFile("0021_test.sql", sql, SYNCED)).toEqual([]);
  });

  it("treats unqualified CREATE FUNCTION as public-schema (search_path default)", () => {
    // F-A — unqualified CREATE FUNCTION lands in public under the default
    // search_path used by these migrations. Pairing with a public-qualified
    // REVOKE must succeed.
    const sql = `
      CREATE FUNCTION foo() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;
      REVOKE EXECUTE ON FUNCTION public.foo() FROM PUBLIC, authenticated;
    `;
    expect(checkMigrationFile("0021_test.sql", sql, SYNCED)).toEqual([]);
  });

  it("ignores SECURITY DEFINER functions declared in non-public schemas", () => {
    // F-A — the rule's scope is schema `public`. A definer function in
    // `audit` (or any other schema) is out of scope and must not trigger
    // the check.
    const sql = `
      CREATE FUNCTION audit.foo() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;
    `;
    expect(checkMigrationFile("0021_test.sql", sql, SYNCED)).toEqual([]);
  });

  it("flags orphan SECURITY DEFINER even when a non-public CREATE FUNCTION precedes it", () => {
    // S-A — `hasOrphanSecurityDefiner` must filter span-defining CREATE
    // FUNCTION matches by schema. A non-public CREATE FUNCTION (out of scope)
    // would otherwise establish a span that swallows a real public-schema
    // orphan SECURITY DEFINER like `ALTER FUNCTION public.foo() SECURITY
    // DEFINER`, silently shipping the privilege-escalation primitive.
    const sql = `
      CREATE FUNCTION other.helper() RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;
      ALTER FUNCTION public.privileged() SECURITY DEFINER;
    `;
    const failures = checkMigrationFile("0021_test.sql", sql, SYNCED);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.subject).toBe("<function>");
    expect(failures[0]?.message).toContain("SECURITY DEFINER");
  });

  it("flags unpaired definer when partial broad-sweep + named REVOKE only cover one of two functions", () => {
    // F-B — locks in that broad-sweep accumulation works across multiple
    // definer functions while still requiring per-function coverage. The
    // broad-sweep covers PUBLIC for everything; a named REVOKE adds
    // authenticated for `foo` only — `bar` remains unpaired.
    const sql = `
      CREATE FUNCTION foo() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;
      CREATE FUNCTION bar() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 2 $$;
      REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
      REVOKE EXECUTE ON FUNCTION foo() FROM authenticated;
    `;
    const failures = checkMigrationFile("0021_test.sql", sql, SYNCED);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.subject).toBe("bar");
  });
});

describe("listEnforcedMigrations", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "check-grants-list-"));
    writeFileSync(join(tmpDir, "0019_legacy.sql"), "", "utf-8");
    writeFileSync(join(tmpDir, "0020_lockdown.sql"), "", "utf-8");
    writeFileSync(join(tmpDir, "0021_grants.sql"), "", "utf-8");
    writeFileSync(join(tmpDir, "0022_more_grants.sql"), "", "utf-8");
    // Files that should be ignored:
    writeFileSync(join(tmpDir, "README.md"), "", "utf-8");
    writeFileSync(join(tmpDir, "not-a-migration.sql"), "", "utf-8");
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns sorted migrations at or above the cutoff", () => {
    const result = listEnforcedMigrations(tmpDir, 21);
    expect(result).toEqual(["0021_grants.sql", "0022_more_grants.sql"]);
    expect(result).not.toContain("0019_legacy.sql");
    expect(result).not.toContain("0020_lockdown.sql");
  });

  it("includes the predecessor when cutoff is lowered (inclusive boundary)", () => {
    // F5 boundary pin — verifies idx === enforceFromIndex is included AND
    // idx === enforceFromIndex - 1 is excluded. Catches a `>=` → `>` regression.
    expect(listEnforcedMigrations(tmpDir, 20)).toEqual([
      "0020_lockdown.sql",
      "0021_grants.sql",
      "0022_more_grants.sql",
    ]);
  });

  it("excludes pre-cutoff migrations", () => {
    expect(listEnforcedMigrations(tmpDir, 100)).toEqual([]);
  });

  it("ignores files that do not match the NNNN_*.sql pattern", () => {
    const all = listEnforcedMigrations(tmpDir, 0);
    expect(all).not.toContain("README.md");
    expect(all).not.toContain("not-a-migration.sql");
  });
});

describe("checkMigrationsDir", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "check-grants-dir-"));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("ignores legacy migrations below ENFORCE_FROM_INDEX (idx < 21)", () => {
    writeFileSync(
      join(tmpDir, "0001_legacy.sql"),
      `CREATE TABLE "tricks" (id uuid PRIMARY KEY);`,
      "utf-8"
    );
    const failures = checkMigrationsDir(tmpDir, { syncedTables: SYNCED });
    expect(failures).toEqual([]);
  });

  it("flags an in-scope migration that creates a synced table without GRANT", () => {
    writeFileSync(
      join(tmpDir, "0021_broken.sql"),
      `CREATE TABLE "setlists" (id uuid PRIMARY KEY);`,
      "utf-8"
    );
    const failures = checkMigrationsDir(tmpDir, { syncedTables: SYNCED });
    const broken = failures.find((f) => f.file === "0021_broken.sql");
    expect(broken).toBeDefined();
    expect(broken?.subject).toBe("setlists");
  });

  it("does not satisfy the requirement with a GRANT in a different migration file", () => {
    writeFileSync(
      join(tmpDir, "0022_creates.sql"),
      `CREATE TABLE "event_log" (id uuid PRIMARY KEY);`,
      "utf-8"
    );
    writeFileSync(
      join(tmpDir, "0023_grants_after.sql"),
      `GRANT SELECT, INSERT ON "event_log" TO authenticated;`,
      "utf-8"
    );
    const failures = checkMigrationsDir(tmpDir, { syncedTables: SYNCED });
    const creating = failures.find((f) => f.file === "0022_creates.sql");
    expect(creating).toBeDefined();
    expect(creating?.subject).toBe("event_log");
  });

  it("passes against the real src/db/migrations directory (smoke)", () => {
    // End-to-end guard: the canonical migrations tree must always satisfy
    // the GRANT discipline. Catches regressions locally during `pnpm test:run`
    // before CI's `pnpm sync:check:grants` step does.
    const realMigrationsDir = join(process.cwd(), "src", "db", "migrations");
    expect(checkMigrationsDir(realMigrationsDir)).toEqual([]);
  });
});
