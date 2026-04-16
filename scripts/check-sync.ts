import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
// biome-ignore lint/performance/noNamespaceImport: mirrors scripts/generate-sync.ts which iterates every exported table from the Drizzle barrel
import * as schema from "../src/db/schema";
import {
  collectSyncedTables,
  generateClientSchema,
  generateSyncConfigYaml,
  generateSyncedColumns,
  SERVER_ONLY_TABLES,
} from "./generate-sync";

type Artifact = {
  path: string;
  expected: string;
};

function readIfExists(path: string): string {
  try {
    return readFileSync(path, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }
    throw err;
  }
}

function findStaleArtifacts(
  artifacts: readonly Artifact[],
  readArtifact: (path: string) => string = readIfExists
): readonly string[] {
  const stale: string[] = [];
  for (const { path, expected } of artifacts) {
    if (readArtifact(path) !== expected) {
      stale.push(path);
    }
  }
  return stale;
}

function computeExpectedArtifacts(projectRoot: string): readonly Artifact[] {
  const tables = collectSyncedTables(schema, SERVER_ONLY_TABLES);
  return [
    {
      path: join(projectRoot, "powersync", "sync-config.yaml"),
      expected: generateSyncConfigYaml(tables),
    },
    {
      path: join(projectRoot, "src", "sync", "schema.ts"),
      expected: generateClientSchema(tables),
    },
    {
      path: join(projectRoot, "src", "sync", "synced-columns.ts"),
      expected: generateSyncedColumns(tables),
    },
  ];
}

function main(): void {
  const projectRoot = join(import.meta.dirname, "..");
  const artifacts = computeExpectedArtifacts(projectRoot);
  const stale = findStaleArtifacts(artifacts);

  if (stale.length > 0) {
    console.error("Sync artifacts are out of date:");
    for (const path of stale) {
      console.error(`  - ${path}`);
    }
    console.error("\nRun `pnpm sync:generate` and commit the changes.");
    process.exit(1);
  }

  console.log("Sync artifacts are up to date.");
}

export type { Artifact };
export { findStaleArtifacts, readIfExists };

const invokedDirectly =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  main();
}
