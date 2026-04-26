import { execSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROUTE_FILE_RE = /^(page|layout|route)\.(tsx?|jsx?)$/;

interface RouteNode {
  children: RouteNode[];
  isApi: boolean;
  isLayout: boolean;
  isPage: boolean;
  name: string;
  path: string;
}

function scanDirectory(dir: string, basePath: string): RouteNode[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const nodes: RouteNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") {
      continue;
    }

    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      const children = scanDirectory(fullPath, join(basePath, entry.name));
      if (children.length > 0) {
        nodes.push({
          name: entry.name,
          path: join(basePath, entry.name),
          children,
          isPage: false,
          isLayout: false,
          isApi: basePath.includes("api") || entry.name === "api",
        });
      }
    } else if (
      ROUTE_FILE_RE.test(entry.name) &&
      !entry.name.includes(".test.")
    ) {
      const type = entry.name.split(".")[0];
      nodes.push({
        name: entry.name,
        path: join(basePath, entry.name),
        children: [],
        isPage: type === "page" || type === "route",
        isLayout: type === "layout",
        isApi: basePath.includes("api"),
      });
    }
  }

  return nodes;
}

function nodeToMermaid(
  node: RouteNode,
  parentId: string,
  lines: string[],
  idCounter: { value: number }
): void {
  const id = `n${idCounter.value++}`;

  if (node.children.length > 0) {
    const label = node.name;
    lines.push(`  ${parentId} --> ${id}["${label}"]`);

    for (const child of node.children) {
      nodeToMermaid(child, id, lines, idCounter);
    }
  } else if (node.isPage) {
    const label = node.isApi ? `API: ${node.name}` : node.name;
    lines.push(`  ${parentId} --> ${id}(["${label}"])`);
  }
}

function generateMermaid(appDir: string): string {
  const nodes = scanDirectory(appDir, "");
  const lines = ["graph TD"];
  lines.push('  root["src/app/"]');

  const idCounter = { value: 0 };
  for (const node of nodes) {
    nodeToMermaid(node, "root", lines, idCounter);
  }

  return lines.join("\n");
}

function getLastCommitDate(projectRoot: string): string {
  const iso = execSync("git log -1 --format=%cI HEAD", {
    cwd: projectRoot,
    encoding: "utf-8",
  }).trim();
  // Normalize to UTC so local and CI agree. CI's actions/checkout creates a
  // synthetic merge commit dated in UTC; using the committer's original TZ
  // here would flap the date on every PR run for committers east of UTC.
  return new Date(iso).toISOString().slice(0, 10);
}

function generateRouteMap(projectRoot: string): string {
  const appDir = join(projectRoot, "src", "app");
  const mermaid = generateMermaid(appDir);

  return `# Route Map

<!-- Last verified: ${getLastCommitDate(projectRoot)} -->

## Route Structure

\`\`\`mermaid
${mermaid}
\`\`\`

## Route Groups

### \`(marketing)/[locale]/\` — Public Pages (statically generated)
- \`/[locale]\` — Landing page (hero, features, CTAs) — 7 locale variants
- \`/[locale]/privacy\` — Privacy policy — 7 locale variants
- \`/[locale]/faq\` — Frequently asked questions — 7 locale variants
- Bare paths (\`/faq\`, \`/privacy\`) are 302-redirected by proxy to locale-prefixed versions
- The root path \`/\` redirects authenticated users to \`/dashboard\`, unauthenticated users to the locale-prefixed landing page

### \`(app)/\` — Authenticated App
- \`/dashboard\` — Main dashboard
- \`/improve\` — Practice session logging
- \`/train\` — Goal setting and drills
- \`/plan\` — Setlist builder
- \`/perform\` — Performance tracking
- \`/enhance\` — Insights and suggestions
- \`/collect\` — Inventory management
- \`/settings\` — User preferences
- \`/account/[path]\` — Neon Auth account management
- \`/admin\` — Admin dashboard (role-restricted)

### \`auth/\` — Auth Pages
- \`/auth/[path]\` — Sign-in, sign-up (Neon Auth UI)

### \`api/\` — API Routes
- \`/api/auth/[...path]\` — Neon Auth (Better Auth) catch-all
- \`/api/email/unsubscribe\` — Email unsubscribe endpoint
`;
}

function main(): void {
  const projectRoot = join(import.meta.dirname, "..");
  const content = generateRouteMap(projectRoot);
  const outputPath = join(projectRoot, "docs", "diagrams", "route-map.md");
  writeFileSync(outputPath, content, "utf-8");
  console.log(`Route map generated: ${relative(projectRoot, outputPath)}`);
}

export { generateMermaid, generateRouteMap };

main();
