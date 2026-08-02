import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ASSETS_DIR,
  checkPowerSyncAssets,
  REQUIRED_WORKER,
} from "./check-powersync-assets";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "powersync-assets-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function seedWorker(root: string, size = 128): void {
  writeFileSync(join(root, REQUIRED_WORKER), "x".repeat(size));
}

function seedWasm(root: string, names: string[]): void {
  const assets = join(root, ASSETS_DIR);
  mkdirSync(assets, { recursive: true });
  for (const name of names) {
    writeFileSync(join(assets, name), "\0asm");
  }
}

describe("checkPowerSyncAssets", () => {
  it("passes when the worker and at least one WASM asset are present", () => {
    seedWorker(dir);
    seedWasm(dir, ["wa-sqlite-XZW__iJk.wasm"]);

    const result = checkPowerSyncAssets(dir);

    expect(result.missing).toEqual([]);
    expect(result.wasmCount).toBe(1);
  });

  it("counts every WASM asset, ignoring non-WASM siblings", () => {
    seedWorker(dir);
    seedWasm(dir, [
      "wa-sqlite-XZW__iJk.wasm",
      "wa-sqlite-async-rHzzC98y.wasm",
      "mc-wa-sqlite-CnHbhWvs.wasm",
    ]);
    writeFileSync(join(dir, ASSETS_DIR, "notes.txt"), "not wasm");

    expect(checkPowerSyncAssets(dir).wasmCount).toBe(3);
  });

  it("reports the directory itself when the whole tree is absent", () => {
    const absent = join(dir, "does-not-exist");

    const result = checkPowerSyncAssets(absent);

    expect(result.missing).toEqual([absent]);
    expect(result.wasmCount).toBe(0);
  });

  it("reports a missing worker — the postinstall-skipped case", () => {
    seedWasm(dir, ["wa-sqlite-XZW__iJk.wasm"]);

    const result = checkPowerSyncAssets(dir);

    expect(result.missing).toEqual([join(dir, REQUIRED_WORKER)]);
  });

  it("treats a zero-byte worker as missing", () => {
    writeFileSync(join(dir, REQUIRED_WORKER), "");
    seedWasm(dir, ["wa-sqlite-XZW__iJk.wasm"]);

    expect(checkPowerSyncAssets(dir).missing).toEqual([
      join(dir, REQUIRED_WORKER),
    ]);
  });

  it("reports a missing assets directory", () => {
    seedWorker(dir);

    const result = checkPowerSyncAssets(dir);

    expect(result.missing).toEqual([join(dir, ASSETS_DIR)]);
    expect(result.wasmCount).toBe(0);
  });

  it("fails when the assets directory holds no WASM at all", () => {
    seedWorker(dir);
    seedWasm(dir, []);

    const result = checkPowerSyncAssets(dir);

    expect(result.missing).toEqual([]);
    expect(result.wasmCount).toBe(0);
  });
});
