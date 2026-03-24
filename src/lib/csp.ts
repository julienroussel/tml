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
  // 'unsafe-inline' is kept alongside the nonce for CSP Level 1 fallback.
  // CSP Level 2+ browsers automatically ignore 'unsafe-inline' when a nonce
  // is present. The nonce is generated per-request in proxy.ts and passed to
  // next-themes via the ThemeProvider nonce prop.
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    "'wasm-unsafe-eval'",
    "https://va.vercel-scripts.com",
  ],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:", "https://lh3.googleusercontent.com"],
  "font-src": ["'self'"],
  "connect-src": [
    "'self'",
    "https://va.vercel-scripts.com",
    "https://vitals.vercel-insights.com",
    "https://*.powersync.journeyapps.com",
    "wss://*.powersync.journeyapps.com",
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
  // Dev server uses --experimental-https (HTTPS); HMR WebSocket is wss://.
  "connect-src": ["wss://localhost:*"],
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

function directivesToString(
  directives: CspDirectives,
  skip?: ReadonlySet<CspDirectiveName>
): string {
  const parts: string[] = [];
  for (const directive of cspDirectiveNames(directives)) {
    if (skip?.has(directive)) {
      continue;
    }
    const values = directives[directive];
    if (values.length > 0) {
      parts.push(`${directive} ${values.join(" ")}`);
    } else if (BOOLEAN_DIRECTIVES.has(directive)) {
      parts.push(directive);
    }
  }
  return parts.join("; ");
}

const NONCE_PATTERN = /^[A-Za-z0-9+/=]+$/;

interface BuildCspOptions {
  isDev: boolean;
  nonce?: string;
}

/**
 * Appends a nonce source to `script-src`. The existing `'unsafe-inline'` is
 * kept for CSP Level 1 fallback — CSP Level 2+ browsers automatically ignore
 * `'unsafe-inline'` when a nonce or hash source is present.
 */
function applyNonce(directives: CspDirectives, nonce: string): CspDirectives {
  return {
    ...directives,
    "script-src": [...directives["script-src"], `'nonce-${nonce}'`],
  };
}

function buildCsp(options: BuildCspOptions): string {
  let directives = options.isDev
    ? mergeDirectives(BASE_DIRECTIVES, DEV_EXTENSIONS)
    : BASE_DIRECTIVES;

  if (options.nonce !== undefined) {
    if (!NONCE_PATTERN.test(options.nonce)) {
      throw new Error("Invalid CSP nonce format");
    }
    directives = applyNonce(directives, options.nonce);
  }

  // upgrade-insecure-requests tells the browser to upgrade all HTTP requests
  // to HTTPS. In dev mode (HTTP localhost), this breaks server action fetches,
  // service worker registration, and internal navigation.
  const skip = options.isDev
    ? new Set<CspDirectiveName>(["upgrade-insecure-requests"])
    : undefined;

  return directivesToString(directives, skip);
}

export type { BuildCspOptions, CspDirectiveName, CspDirectives };
export {
  applyNonce,
  BASE_DIRECTIVES,
  buildCsp,
  DEV_EXTENSIONS,
  directivesToString,
  mergeDirectives,
};
