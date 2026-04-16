import { spawnSync } from "node:child_process";

// Storage-facing env vars are POWERSYNC_*-prefixed (in .env.example and
// GitHub secrets/variables) for clarity. The PowerSync CLI itself reads
// bare names (plus PS_ADMIN_TOKEN). This wrapper maps one to the other so
// there is a single, consistent naming convention in the repo.
const ENV_ALIASES: Readonly<Record<string, string>> = {
  POWERSYNC_ADMIN_TOKEN: "PS_ADMIN_TOKEN",
  POWERSYNC_INSTANCE_ID: "INSTANCE_ID",
  POWERSYNC_PROJECT_ID: "PROJECT_ID",
  POWERSYNC_ORG_ID: "ORG_ID",
};

const env: NodeJS.ProcessEnv = { ...process.env };
for (const [from, to] of Object.entries(ENV_ALIASES)) {
  const value = env[from];
  // Empty strings are treated as unset — falling through to a missing bare
  // name gives the CLI a chance to emit its own "required" error rather
  // than a cryptic downstream failure from an empty ID.
  if (value !== undefined && value !== "" && env[to] === undefined) {
    env[to] = value;
  }
}

const args = process.argv.slice(2);
const result = spawnSync("powersync", args, { stdio: "inherit", env });
process.exit(result.status ?? 1);
