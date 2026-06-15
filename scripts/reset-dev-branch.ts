import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";

/**
 * Resets the Neon dev branch from its parent AND re-bootstraps the dev
 * PowerSync instance in one step.
 *
 * A bare `neon branches reset` invalidates the LSN positions PowerSync's
 * logical replication slot tracks: the instance keeps reporting
 * `Status: connected` but server-side buckets stop materializing (degraded
 * pill, `ps_oplog = 0`, only the `$local` bucket). The fix is a full
 * `powersync deploy`, which recreates the slot on the freshly reset branch.
 * See `.claude/rules/sync-engine.md` -> "Source-DB drift (#338)" -> "Neon
 * branch reset hazard". This pairs both halves so the slot is never left
 * orphaned (#345).
 *
 * Run via `pnpm reset:dev-branch` (loads `.env.local`). Pass `--yes`/`-y` to
 * skip the confirmation prompt.
 */

// Defaults target the solo-dev branch. Override NEON_DEV_BRANCH for a different
// developer branch; the PowerSync IDs come from .env.local.
const NEON_PROJECT_ID = process.env.NEON_PROJECT_ID ?? "snowy-wind-99317396";
const NEON_DEV_BRANCH = process.env.NEON_DEV_BRANCH ?? "dev/julien";

// This dev tool must never reset + re-bootstrap the prod instance. ID from
// `.claude/rules/sync-engine.md` -> "PowerSync Instance Topology".
const PROD_POWERSYNC_INSTANCE_ID = "69b6f2747c4f8b306a1bc349";

// Pinned to match .github/workflows/neon-branch-cleanup.yml.
const NEONCTL_VERSION = "2.22.0";

type ResetEnv = {
  powersyncAdminToken: string;
  powersyncInstanceId: string;
  powersyncProjectId: string;
};

function readEnv(): ResetEnv {
  const missing: string[] = [];
  const getRequired = (name: string): string => {
    const value = process.env[name]?.trim();
    if (value === undefined || value === "") {
      missing.push(name);
      return "";
    }
    return value;
  };
  // neonctl reads NEON_API_KEY from the environment itself; require it up front
  // so we fail with a clear message instead of an opaque neonctl auth error.
  getRequired("NEON_API_KEY");
  const env: ResetEnv = {
    powersyncAdminToken: getRequired("POWERSYNC_ADMIN_TOKEN"),
    powersyncInstanceId: getRequired("POWERSYNC_INSTANCE_ID"),
    powersyncProjectId: getRequired("POWERSYNC_PROJECT_ID"),
  };
  if (missing.length > 0) {
    throw new Error(
      `Missing required env: ${missing.join(", ")}. POWERSYNC_* come from .env.local; set NEON_API_KEY in your shell profile (see .env.example).`
    );
  }
  return env;
}

function run(
  command: string,
  args: readonly string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): void {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    cwd: options.cwd,
    env: options.env ?? process.env,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const reason =
      result.status === null
        ? `signal ${result.signal}`
        : `exit ${result.status}`;
    throw new Error(`\`${command} ${args.join(" ")}\` failed (${reason})`);
  }
}

async function confirm(instanceId: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ac = new AbortController();
  // Ctrl+C aborts hard (exit 130). EOF (Ctrl+D) ends the input stream, which
  // would otherwise leave question() hanging forever and the process exiting 0
  // — aborting the signal turns EOF into a clean decline instead.
  rl.on("SIGINT", () => {
    rl.close();
    process.exit(130);
  });
  rl.on("close", () => ac.abort());
  try {
    const answer = await rl.question(
      `Reset Neon branch "${NEON_DEV_BRANCH}" from its parent (discards ALL data on it) and re-bootstrap PowerSync instance ${instanceId}.\nContinue? [y/N] `,
      { signal: ac.signal }
    );
    const normalized = answer.trim().toLowerCase();
    return normalized === "y" || normalized === "yes";
  } catch {
    // EOF or other prompt error → decline (fail closed for a destructive op).
    return false;
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const skipConfirm = process.argv
    .slice(2)
    .some((arg) => arg === "--yes" || arg === "-y");
  const env = readEnv();

  if (env.powersyncInstanceId === PROD_POWERSYNC_INSTANCE_ID) {
    throw new Error(
      `POWERSYNC_INSTANCE_ID points at the PROD instance (${PROD_POWERSYNC_INSTANCE_ID}). This tool only resets the dev branch + dev instance. Aborting.`
    );
  }

  if (!skipConfirm) {
    if (!process.stdin.isTTY) {
      throw new Error(
        "Non-interactive shell: re-run with --yes to confirm the reset."
      );
    }
    if (!(await confirm(env.powersyncInstanceId))) {
      console.log("Aborted.");
      return;
    }
  }

  // 1. Reset the Neon dev branch from its parent. `--parent` is required —
  //    Neon only supports reset-from-parent and the flag defaults to false.
  console.log(
    `\nStep 1/2: resetting Neon branch ${NEON_DEV_BRANCH} from parent...`
  );
  run("npx", [
    "--yes",
    `neonctl@${NEONCTL_VERSION}`,
    "branches",
    "reset",
    NEON_DEV_BRANCH,
    "--parent",
    "--project-id",
    NEON_PROJECT_ID,
  ]);

  // 2. Re-bootstrap PowerSync. `pull instance` links + downloads the deployed
  //    config into a temp dir; the full `deploy` (connections + auth + sync
  //    config) then forces replication-slot recreation on the reset branch.
  //    `deploy service-config` would leave the slot orphaned on the pre-reset
  //    LSN — same symptom, harder to diagnose. The powersync binary walks up
  //    for package.json, so from the temp dir it must be invoked by absolute
  //    path with the CLI's bare env names (POWERSYNC_ADMIN_TOKEN -> PS_ADMIN_TOKEN,
  //    the rest -> bare INSTANCE_ID/PROJECT_ID/ORG_ID).
  const workDir = mkdtempSync(join(tmpdir(), "ps-reset-"));
  const powersyncBin = join(
    import.meta.dirname,
    "..",
    "node_modules",
    ".bin",
    "powersync"
  );
  const powersyncEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PS_ADMIN_TOKEN: env.powersyncAdminToken,
    INSTANCE_ID: env.powersyncInstanceId,
    PROJECT_ID: env.powersyncProjectId,
  };
  // ORG_ID is only needed for a PAT spanning multiple orgs (see .env.example);
  // forward it when set, mirroring scripts/powersync.ts's alias map.
  const orgId = process.env.POWERSYNC_ORG_ID?.trim();
  if (orgId) {
    powersyncEnv.ORG_ID = orgId;
  }

  console.log(
    `\nStep 2/2: re-bootstrapping PowerSync instance ${env.powersyncInstanceId}...`
  );
  // The pulled service.yaml carries the source DB password in plaintext (#346),
  // so the temp dir is removed in a finally — on a successful or failed deploy
  // alike. (A hard signal kill mid-deploy still bypasses it; OS tmp cleanup is
  // the backstop there.)
  try {
    run(
      powersyncBin,
      [
        "pull",
        "instance",
        `--project-id=${env.powersyncProjectId}`,
        `--instance-id=${env.powersyncInstanceId}`,
      ],
      { cwd: workDir, env: powersyncEnv }
    );
    run(powersyncBin, ["deploy"], { cwd: workDir, env: powersyncEnv });
  } catch (error) {
    // Step 1 already reset the branch, so the slot is now orphaned. Re-running
    // the whole flow is safe — it is idempotent.
    throw new Error(
      `PowerSync re-bootstrap failed, but the Neon branch was already reset — the replication slot is orphaned. Re-run \`pnpm reset:dev-branch\` to retry (idempotent). Cause: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }

  console.log(
    `\nDone. Verify the slot was recreated:\n  pnpm exec tsx --env-file-if-exists=.env.local scripts/powersync.ts fetch status --instance-id=${env.powersyncInstanceId} --project-id=${env.powersyncProjectId}\n  (expect a bumped slot version and "Initial replication done: true")`
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
