import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Artifact, findStaleArtifacts, readIfExists } from "./check-sync";

describe("readIfExists", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "check-sync-"));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns file contents for existing files", () => {
    const path = join(tmpDir, "hello.txt");
    writeFileSync(path, "hello world\n", "utf-8");
    expect(readIfExists(path)).toBe("hello world\n");
  });

  it("returns empty string when the file does not exist (ENOENT)", () => {
    expect(readIfExists(join(tmpDir, "does-not-exist.txt"))).toBe("");
  });

  it("rethrows non-ENOENT errors (e.g. EISDIR when reading a directory)", () => {
    expect(() => readIfExists(tmpDir)).toThrow();
  });
});

describe("findStaleArtifacts", () => {
  const artifacts: readonly Artifact[] = [
    { path: "/virtual/a", expected: "alpha\n" },
    { path: "/virtual/b", expected: "bravo\n" },
    { path: "/virtual/c", expected: "charlie\n" },
  ];

  it("returns an empty list when every artifact matches expected content", () => {
    const reader = (path: string): string => {
      const match = artifacts.find((a) => a.path === path);
      return match?.expected ?? "";
    };
    expect(findStaleArtifacts(artifacts, reader)).toEqual([]);
  });

  it("identifies artifacts whose content does not match expected", () => {
    const reader = (path: string): string => {
      if (path === "/virtual/b") {
        return "MUTATED\n";
      }
      const match = artifacts.find((a) => a.path === path);
      return match?.expected ?? "";
    };
    expect(findStaleArtifacts(artifacts, reader)).toEqual(["/virtual/b"]);
  });

  it("treats missing artifacts (empty read) as stale", () => {
    const reader = (): string => "";
    expect(findStaleArtifacts(artifacts, reader)).toEqual([
      "/virtual/a",
      "/virtual/b",
      "/virtual/c",
    ]);
  });

  it("preserves the input order when reporting multiple stale artifacts", () => {
    const reader = (path: string): string => {
      if (path === "/virtual/a" || path === "/virtual/c") {
        return "MUTATED\n";
      }
      const match = artifacts.find((a) => a.path === path);
      return match?.expected ?? "";
    };
    expect(findStaleArtifacts(artifacts, reader)).toEqual([
      "/virtual/a",
      "/virtual/c",
    ]);
  });
});
