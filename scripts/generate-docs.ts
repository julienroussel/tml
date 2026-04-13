import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

interface GeneratorResult {
  message: string;
  name: string;
  success: boolean;
}

function runGenerator(
  name: string,
  scriptPath: string,
  projectRoot: string
): GeneratorResult {
  const fullPath = join(projectRoot, scriptPath);

  if (!existsSync(fullPath)) {
    return { name, success: false, message: `Script not found: ${scriptPath}` };
  }

  try {
    execSync(`npx tsx ${fullPath}`, {
      encoding: "utf-8",
      cwd: projectRoot,
      stdio: "pipe",
    });
    return { name, success: true, message: "Generated" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { name, success: false, message };
  }
}

function generateAll(projectRoot: string): GeneratorResult[] {
  const generators = [
    { name: "Route map", script: "scripts/generate-route-map.ts" },
    { name: "llms.txt", script: "scripts/generate-llms-txt.ts" },
  ];

  const results: GeneratorResult[] = [];

  for (const generator of generators) {
    const result = runGenerator(generator.name, generator.script, projectRoot);
    results.push(result);
    const icon = result.success ? "[OK]" : "[FAIL]";
    console.log(`  ${icon} ${result.name}: ${result.message}`);
  }

  return results;
}

function main(): void {
  const projectRoot = join(import.meta.dirname, "..");

  console.log("\nGenerating documentation...\n");
  const results = generateAll(projectRoot);

  const failures = results.filter((r) => !r.success);
  console.log("");

  if (failures.length > 0) {
    console.log(`${failures.length} generator(s) failed.`);
    process.exit(1);
  }

  console.log("All documentation generated successfully.");
}

export { generateAll, runGenerator };

main();
