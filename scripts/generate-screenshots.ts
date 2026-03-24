import { execSync } from "node:child_process";
import { join } from "node:path";
import { chromium } from "@playwright/test";

/**
 * Generates PWA manifest screenshots by launching a headless browser
 * against the running dev server and capturing the landing page at
 * desktop (1280x720) and mobile (390x844) viewports.
 *
 * Prerequisites: dev server must be running (`pnpm dev`).
 *
 * Usage: pnpm screenshots
 */

const BASE_URL = process.env.BASE_URL ?? "https://localhost:3000";
const OUTPUT_DIR = join(import.meta.dirname, "..", "public");

interface Screenshot {
  height: number;
  name: string;
  path: string;
  width: number;
}

const screenshots: Screenshot[] = [
  {
    name: "desktop",
    width: 1280,
    height: 720,
    path: join(OUTPUT_DIR, "screenshot-desktop.png"),
  },
  {
    name: "mobile",
    width: 390,
    height: 844,
    path: join(OUTPUT_DIR, "screenshot-mobile.png"),
  },
];

async function main(): Promise<void> {
  console.log(`\nGenerating PWA screenshots from ${BASE_URL}\n`);

  const browser = await chromium.launch();

  for (const shot of screenshots) {
    const context = await browser.newContext({
      viewport: { width: shot.width, height: shot.height },
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();

    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.screenshot({ path: shot.path, type: "png" });
    await context.close();

    console.log(
      `  [OK] ${shot.name} (${shot.width}x${shot.height}): ${shot.path.split("/").pop()}`
    );
  }

  await browser.close();

  // Optimize PNGs for smaller file size
  console.log("\n  Optimizing with optipng...\n");
  for (const shot of screenshots) {
    try {
      execSync(`optipng -o7 "${shot.path}"`, { stdio: "pipe" });
      console.log(`  [OK] optimized ${shot.path.split("/").pop()}`);
    } catch {
      console.warn(
        "  [SKIP] optipng not found — install it for smaller PNGs (brew install optipng)"
      );
      break;
    }
  }

  console.log("\nDone.\n");
}

main().catch((error: unknown) => {
  console.error("Screenshot generation failed:", error);
  process.exit(1);
});
