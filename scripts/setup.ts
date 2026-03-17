import { execSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

interface CheckResult {
  message: string;
  name: string;
  passed: boolean;
}

function checkCommand(name: string, command: string): CheckResult {
  try {
    const version = execSync(command, { encoding: "utf-8" }).trim();
    return { name, passed: true, message: version };
  } catch {
    return { name, passed: false, message: `${name} not found` };
  }
}

function checkNodeVersion(): CheckResult {
  const result = checkCommand("Node.js", "node --version");
  if (!result.passed) {
    return result;
  }
  const major = Number.parseInt(result.message.replace("v", ""), 10);
  if (major < 24) {
    return {
      name: "Node.js",
      passed: false,
      message: `Node.js 24+ required, found ${result.message}`,
    };
  }
  return result;
}

function checkPnpmVersion(): CheckResult {
  const result = checkCommand("pnpm", "pnpm --version");
  if (!result.passed) {
    return result;
  }
  const major = Number.parseInt(result.message, 10);
  if (major < 10) {
    return {
      name: "pnpm",
      passed: false,
      message: `pnpm 10+ required, found ${result.message}`,
    };
  }
  return result;
}

function setupEnvFile(projectRoot: string): CheckResult {
  const envLocal = join(projectRoot, ".env.local");
  const envExample = join(projectRoot, ".env.example");

  if (existsSync(envLocal)) {
    return {
      name: ".env.local",
      passed: true,
      message: "Already exists",
    };
  }

  if (!existsSync(envExample)) {
    return {
      name: ".env.local",
      passed: false,
      message: ".env.example not found",
    };
  }

  copyFileSync(envExample, envLocal);
  return {
    name: ".env.local",
    passed: true,
    message: "Created from .env.example",
  };
}

function installDeps(): CheckResult {
  try {
    execSync("pnpm install --frozen-lockfile", {
      encoding: "utf-8",
      stdio: "pipe",
    });
    return { name: "Dependencies", passed: true, message: "Installed" };
  } catch {
    try {
      execSync("pnpm install", { encoding: "utf-8", stdio: "pipe" });
      return {
        name: "Dependencies",
        passed: true,
        message: "Installed (lockfile updated)",
      };
    } catch {
      return {
        name: "Dependencies",
        passed: false,
        message: "Failed to install",
      };
    }
  }
}

function runChecks(projectRoot: string): CheckResult[] {
  return [
    checkNodeVersion(),
    checkPnpmVersion(),
    setupEnvFile(projectRoot),
    installDeps(),
  ];
}

function printResults(results: CheckResult[]): boolean {
  console.log("\nThe Magic Lab — Setup\n");

  let allPassed = true;
  for (const result of results) {
    const icon = result.passed ? "[OK]" : "[FAIL]";
    console.log(`  ${icon} ${result.name}: ${result.message}`);
    if (!result.passed) {
      allPassed = false;
    }
  }

  console.log("");

  if (allPassed) {
    console.log("Setup complete! Next steps:");
    console.log("");
    console.log("  1. Edit .env.local with your credentials");
    console.log("  2. Set up a Neon database and add DATABASE_URL");
    console.log("  3. Configure OAuth providers (Google, Apple, Microsoft)");
    console.log("  4. Generate VAPID keys: npx web-push generate-vapid-keys");
    console.log("  5. Run: pnpm dev");
  } else {
    console.log("Some checks failed. Please fix the issues above.");
  }

  console.log("");
  return allPassed;
}

function main(): void {
  const projectRoot = join(import.meta.dirname, "..");
  const results = runChecks(projectRoot);
  const allPassed = printResults(results);

  if (!allPassed) {
    process.exit(1);
  }
}

export { checkNodeVersion, checkPnpmVersion, runChecks, setupEnvFile };

main();
