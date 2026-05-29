import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  findSecretMarkers,
  SERVER_OUTPUT_EXTENSIONS,
  scanDirectory,
  VALUE_SHAPE_PATTERNS,
} from "./check-bundle-secrets";

describe("findSecretMarkers", () => {
  it("flags a Neon password value", () => {
    expect(findSecretMarkers("const x = 'npg_abc123XYZ';")).toContain(
      "neon-password"
    );
  });

  it("flags a Postgres URI carrying inline credentials", () => {
    expect(
      findSecretMarkers(
        "postgresql://app_user:p4ssw0rd@db.example.com:5432/app"
      )
    ).toContain("postgres-uri-credentials");
  });

  it("flags a PEM private key block", () => {
    expect(
      findSecretMarkers("-----BEGIN RSA PRIVATE KEY-----\nMIIEvQ...")
    ).toContain("pem-private-key");
  });

  it("flags the PowerSync admin token env name", () => {
    expect(findSecretMarkers("process.env.POWERSYNC_ADMIN_TOKEN")).toContain(
      "powersync-admin-token"
    );
  });

  it("flags the database URL env name", () => {
    expect(findSecretMarkers("const c = process.env.DATABASE_URL;")).toContain(
      "database-url"
    );
  });

  it("flags the internal E2E bucket-health override marker", () => {
    expect(
      findSecretMarkers("globalThis.__TEST_FORCE_BUCKET_HEALTH = true;")
    ).toContain("test-bucket-health-override");
  });

  it("returns every matching pattern when a string trips more than one", () => {
    const hits = findSecretMarkers(
      "postgresql://u:npg_abc123@db.example.com/app"
    );
    expect(hits).toContain("neon-password");
    expect(hits).toContain("postgres-uri-credentials");
    expect(hits).toHaveLength(2);
  });

  it("does not match near-misses of each pattern", () => {
    // `npg` without the underscore the prefix requires.
    expect(findSecretMarkers("const id = 'npgfoo';")).toEqual([]);
    // Postgres URI with no inline credentials (no `user:pass@`).
    expect(findSecretMarkers("postgresql://db.example.com/app")).toEqual([]);
    // PUBLIC key, not PRIVATE.
    expect(findSecretMarkers("-----BEGIN PUBLIC KEY-----")).toEqual([]);
  });

  it("passes clean PowerSync SDK table-name queries", () => {
    expect(findSecretMarkers('useQuery("SELECT * FROM ps_buckets")')).toEqual(
      []
    );
  });

  it("passes a NEXT_PUBLIC env reference", () => {
    expect(
      findSecretMarkers("const u = process.env.NEXT_PUBLIC_POWERSYNC_URL;")
    ).toEqual([]);
  });
});

describe("scanDirectory", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "bundle-secrets-"));
  });

  afterEach(() => {
    rmSync(dir, { force: true, recursive: true });
  });

  it("reports a planted secret and ignores clean assets", () => {
    writeFileSync(
      join(dir, "clean.js"),
      'useQuery("SELECT * FROM ps_buckets");'
    );
    writeFileSync(
      join(dir, "leak.js"),
      'const c = "postgresql://u:p4ss@db/app";'
    );

    const result = scanDirectory(dir);

    expect(result.scannedCount).toBe(2);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.file).toContain("leak.js");
    expect(result.findings[0]?.patterns).toContain("postgres-uri-credentials");
  });

  it("walks nested chunk directories and counts source maps", () => {
    mkdirSync(join(dir, "chunks"));
    writeFileSync(join(dir, "chunks", "a.js"), "export const x = 1;");
    writeFileSync(join(dir, "chunks", "a.js.map"), '{"version":3}');

    const result = scanDirectory(dir);

    expect(result.scannedCount).toBe(2);
    expect(result.sourceMapCount).toBe(1);
    expect(result.findings).toHaveLength(0);
  });

  it("ignores non-asset file types", () => {
    writeFileSync(join(dir, "notes.txt"), "npg_deadbeefcafe");

    const result = scanDirectory(dir);

    expect(result.scannedCount).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it("reports a secret planted inside a source map", () => {
    writeFileSync(
      join(dir, "app.js.map"),
      '{"sources":["x"],"sourcesContent":["const c = \'npg_deadbeefcafe\';"]}'
    );

    const result = scanDirectory(dir);

    expect(result.sourceMapCount).toBe(1);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.patterns).toContain("neon-password");
  });

  it("skips a directory whose name matches an asset extension", () => {
    // The collectAssetFiles guard must reject non-regular files (a directory
    // literally named `fake.js`) without throwing on the later read.
    mkdirSync(join(dir, "fake.js"));
    writeFileSync(join(dir, "real.js"), "export const x = 1;");

    const result = scanDirectory(dir);

    expect(result.scannedCount).toBe(1);
    expect(result.findings).toHaveLength(0);
  });

  it("returns no findings for an empty directory", () => {
    expect(scanDirectory(dir).findings).toHaveLength(0);
  });
});

describe("scanDirectory — prerendered server output (.html/.rsc)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "bundle-secrets-server-"));
  });

  afterEach(() => {
    rmSync(dir, { force: true, recursive: true });
  });

  it("flags a secret value rendered into a prerendered page", () => {
    writeFileSync(
      join(dir, "landing.html"),
      "<p>postgresql://u:p4ss@db.example.com/app</p>"
    );

    const result = scanDirectory(
      dir,
      VALUE_SHAPE_PATTERNS,
      SERVER_OUTPUT_EXTENSIONS
    );

    expect(result.scannedCount).toBe(1);
    expect(result.findings[0]?.patterns).toContain("postgres-uri-credentials");
  });

  it("does not apply env-var NAME patterns to server output", () => {
    // `DATABASE_URL` legitimately appears in server output; the value-shape
    // subset must NOT flag it — that exclusion is the point of the subset.
    writeFileSync(join(dir, "page.rsc"), "process.env.DATABASE_URL");

    const result = scanDirectory(
      dir,
      VALUE_SHAPE_PATTERNS,
      SERVER_OUTPUT_EXTENSIONS
    );

    expect(result.findings).toHaveLength(0);
  });

  it("ignores server JS — only .html/.rsc/.body are in server scope", () => {
    writeFileSync(join(dir, "chunk.js"), "const c = 'npg_abc123XYZ';");

    const result = scanDirectory(
      dir,
      VALUE_SHAPE_PATTERNS,
      SERVER_OUTPUT_EXTENSIONS
    );

    expect(result.scannedCount).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it("scans .body response bodies (sitemap/manifest/route handlers)", () => {
    writeFileSync(
      join(dir, "sitemap.xml.body"),
      "<url><loc>postgresql://u:p4ss@db.example.com/app</loc></url>"
    );

    const result = scanDirectory(
      dir,
      VALUE_SHAPE_PATTERNS,
      SERVER_OUTPUT_EXTENSIONS
    );

    expect(result.scannedCount).toBe(1);
    expect(result.findings[0]?.patterns).toContain("postgres-uri-credentials");
  });
});

describe("VALUE_SHAPE_PATTERNS composition", () => {
  it("is exactly the value-shape subset used for server output", () => {
    // Security-load-bearing invariant: dropping a value pattern here would
    // silently stop scanning that shape in browser-served prerendered pages.
    expect(VALUE_SHAPE_PATTERNS.map((p) => p.name)).toEqual([
      "neon-password",
      "postgres-uri-credentials",
      "pem-private-key",
    ]);
  });
});
