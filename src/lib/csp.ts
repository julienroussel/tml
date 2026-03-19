interface CspDirectives {
  "base-uri": string[];
  "connect-src": string[];
  "default-src": string[];
  "font-src": string[];
  "form-action": string[];
  "frame-ancestors": string[];
  "frame-src": string[];
  "img-src": string[];
  "object-src": string[];
  "script-src": string[];
  "style-src": string[];
  "upgrade-insecure-requests": string[];
  "worker-src": string[];
}

type CspDirectiveName = keyof CspDirectives;

const ALL_DIRECTIVE_NAMES = [
  "base-uri",
  "connect-src",
  "default-src",
  "font-src",
  "form-action",
  "frame-ancestors",
  "frame-src",
  "img-src",
  "object-src",
  "script-src",
  "style-src",
  "upgrade-insecure-requests",
  "worker-src",
] as const satisfies readonly CspDirectiveName[];

// Compile-time check: fails if a CspDirectiveName is missing from the array
type AssertAllDirectives =
  Exclude<CspDirectiveName, (typeof ALL_DIRECTIVE_NAMES)[number]> extends never
    ? true
    : never;
true satisfies AssertAllDirectives;

function cspDirectiveNames(
  directives: Partial<CspDirectives>
): CspDirectiveName[] {
  return ALL_DIRECTIVE_NAMES.filter((key) => key in directives);
}

const BASE_DIRECTIVES: CspDirectives = {
  "default-src": ["'self'"],
  // 'unsafe-inline' is required for next-themes to inject the theme-setting
  // script that prevents a flash of unstyled content (FOUC) on page load.
  // next-themes injects an inline <script> in <head> before React hydrates,
  // so we cannot replace this with a nonce or hash without patching the library.
  // Migrate to nonce-based CSP — next-themes v0.4.6+ supports the nonce prop. See #44.
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    "'wasm-unsafe-eval'",
    "https://va.vercel-scripts.com",
  ],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:"],
  "font-src": ["'self'"],
  "connect-src": [
    "'self'",
    "https://va.vercel-scripts.com",
    "https://vitals.vercel-insights.com",
    "https://*.powersync.journeyapps.com",
    "https://*.neonauth.c-2.eu-central-1.aws.neon.tech",
    "https://*.apirest.c-2.eu-central-1.aws.neon.tech",
  ],
  "worker-src": ["'self'"],
  "object-src": ["'none'"],
  "frame-ancestors": ["'none'"],
  "frame-src": [],
  "base-uri": ["'self'"],
  "form-action": [
    "'self'",
    "https://*.neonauth.c-2.eu-central-1.aws.neon.tech",
  ],
  "upgrade-insecure-requests": [],
};

const DEV_EXTENSIONS: Partial<CspDirectives> = {
  "script-src": ["'unsafe-eval'"],
  "connect-src": ["ws://localhost:*"],
  "frame-src": ["https://local.drizzle.studio"],
};

function mergeDirectives(
  base: CspDirectives,
  extensions: Partial<CspDirectives>
): CspDirectives {
  const result = { ...base };

  for (const directive of cspDirectiveNames(extensions)) {
    if (directive in base) {
      const additions = extensions[directive];
      if (additions) {
        result[directive] = [...result[directive], ...additions];
      }
    }
  }

  return result;
}

const BOOLEAN_DIRECTIVES: ReadonlySet<CspDirectiveName> = new Set([
  "upgrade-insecure-requests",
]);

function directivesToString(directives: CspDirectives): string {
  const parts: string[] = [];
  for (const directive of cspDirectiveNames(directives)) {
    const values = directives[directive];
    if (values.length > 0) {
      parts.push(`${directive} ${values.join(" ")}`);
    } else if (BOOLEAN_DIRECTIVES.has(directive)) {
      parts.push(directive);
    }
  }
  return parts.join("; ");
}

function buildCsp(isDev: boolean): string {
  const directives = isDev
    ? mergeDirectives(BASE_DIRECTIVES, DEV_EXTENSIONS)
    : BASE_DIRECTIVES;

  return directivesToString(directives);
}

export type { CspDirectiveName, CspDirectives };
export {
  BASE_DIRECTIVES,
  buildCsp,
  DEV_EXTENSIONS,
  directivesToString,
  mergeDirectives,
};
