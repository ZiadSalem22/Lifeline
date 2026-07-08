import dotenv from 'dotenv';
import { z } from 'zod';

/**
 * Environment configuration, validated once at boot.
 *
 * Semantics follow docs/issues/clean-rebuild/discovery/audit-auth.md §5 with the
 * rebuild deltas from planning/05-decisions.md:
 * - NO hardcoded Auth0 tenant/audience fallbacks. In production (unless
 *   AUTH_DISABLED='1') AUTH0_DOMAIN + AUTH0_AUDIENCE and a non-empty
 *   MCP_API_KEY_PEPPER are required and validated here, at boot.
 * - Legacy CORS origin vars (APP_ORIGIN, FRONTEND_URL, WEB_CLIENT_URL,
 *   FRONTEND_ORIGIN) are still honored and merged into CORS_ORIGINS.
 */

const NODE_ENVS = ['development', 'test', 'production'] as const;
export type NodeEnv = (typeof NODE_ENVS)[number];

export const DEV_DATABASE_URL = 'postgres://lifeline:lifeline@localhost:5432/lifeline';

export interface Env {
  NODE_ENV: NodeEnv;
  PORT: number;
  LOG_LEVEL: string;
  DATABASE_URL: string;
  /** Normalized tenant domain (protocol + trailing slash stripped), or null when unset. */
  AUTH0_DOMAIN: string | null;
  /** Merged AUTH0_AUDIENCE + AUTH0_AUDIENCE_ALT CSV values. */
  AUTH0_AUDIENCES: string[];
  /** `AUTH_DISABLED='1'` bypasses JWT verification and attaches a local user. */
  AUTH_DISABLED: boolean;
  AUTH_LOCAL_USER_ID: string;
  AUTH_TIMEOUT_MS: number;
  /** HMAC key for MCP API-key secret hashing. Empty only outside production. */
  MCP_API_KEY_PEPPER: string;
  /** CORS allowlist: CORS_ORIGIN CSV merged with the legacy origin vars. */
  CORS_ORIGINS: string[];
  MCP_AUTH0_DOMAIN: string | null;
  MCP_AUTH0_AUDIENCES: string[];
  MCP_AUTH0_ISSUER: string | null;
  MCP_PUBLIC_BASE_URL: string | null;
  MCP_AUTH0_SUPPORTED_SCOPES: string[];
  /** Raw express `trust proxy` setting value, or null when unset. */
  TRUST_PROXY: string | null;
  /** Directory of the built web SPA to serve in production, or null (API-only). */
  WEB_DIST_DIR: string | null;
}

/** Strip protocol and trailing slashes: `https://tenant.auth0.com/` -> `tenant.auth0.com`. */
export function normalizeAuth0Domain(value: string | undefined): string | null {
  if (value === undefined) return null;
  const normalized = value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  return normalized === '' ? null : normalized;
}

function splitCsv(value: string | undefined): string[] {
  if (value === undefined) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values)];
}

const rawSchema = z.object({
  NODE_ENV: z.enum(NODE_ENVS).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.string().trim().min(1).optional(),
  DATABASE_URL: z.string().trim().min(1).optional(),
  AUTH0_DOMAIN: z.string().trim().optional(),
  AUTH0_AUDIENCE: z.string().trim().optional(),
  AUTH0_AUDIENCE_ALT: z.string().trim().optional(),
  AUTH_DISABLED: z.string().optional(),
  AUTH_LOCAL_USER_ID: z.string().trim().min(1).default('guest-local'),
  AUTH_TIMEOUT_MS: z.coerce.number().int().min(1).default(10_000),
  MCP_API_KEY_PEPPER: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  APP_ORIGIN: z.string().optional(),
  FRONTEND_URL: z.string().optional(),
  WEB_CLIENT_URL: z.string().optional(),
  FRONTEND_ORIGIN: z.string().optional(),
  MCP_AUTH0_DOMAIN: z.string().trim().optional(),
  MCP_AUTH0_AUDIENCE: z.string().trim().optional(),
  MCP_AUTH0_AUDIENCE_ALT: z.string().trim().optional(),
  MCP_AUTH0_ISSUER: z.string().trim().optional(),
  MCP_PUBLIC_BASE_URL: z.string().trim().optional(),
  MCP_AUTH0_SUPPORTED_SCOPES: z.string().optional(),
  TRUST_PROXY: z.string().trim().optional(),
  WEB_DIST_DIR: z.string().trim().optional(),
});

/**
 * Parse and validate an environment map (defaults to nothing — pass
 * `process.env` via {@link loadEnv} at bootstrap; tests pass fixtures).
 * Throws on invalid or (in production) missing required configuration.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const raw = rawSchema.parse(source);

  const nodeEnv = raw.NODE_ENV;
  const authDisabled = raw.AUTH_DISABLED === '1';
  const isProduction = nodeEnv === 'production';

  const databaseUrl = raw.DATABASE_URL ?? (isProduction ? undefined : DEV_DATABASE_URL);
  const auth0Domain = normalizeAuth0Domain(raw.AUTH0_DOMAIN);
  const auth0Audiences = dedupe([
    ...splitCsv(raw.AUTH0_AUDIENCE),
    ...splitCsv(raw.AUTH0_AUDIENCE_ALT),
  ]);
  const pepper = raw.MCP_API_KEY_PEPPER ?? '';

  const issues: string[] = [];
  if (databaseUrl === undefined) {
    issues.push('DATABASE_URL is required in production');
  }
  if (isProduction && !authDisabled) {
    if (auth0Domain === null) issues.push('AUTH0_DOMAIN is required in production');
    if (auth0Audiences.length === 0) issues.push('AUTH0_AUDIENCE is required in production');
    if (pepper.trim() === '') {
      issues.push('MCP_API_KEY_PEPPER is required (non-empty) in production');
    }
  }
  if (issues.length > 0) {
    throw new Error(`Invalid environment configuration: ${issues.join('; ')}`);
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: raw.PORT,
    LOG_LEVEL: raw.LOG_LEVEL ?? (nodeEnv === 'development' ? 'debug' : 'info'),
    // databaseUrl is proven defined above (issues[] throw); keep the narrow explicit.
    DATABASE_URL: databaseUrl as string,
    AUTH0_DOMAIN: auth0Domain,
    AUTH0_AUDIENCES: auth0Audiences,
    AUTH_DISABLED: authDisabled,
    AUTH_LOCAL_USER_ID: raw.AUTH_LOCAL_USER_ID,
    AUTH_TIMEOUT_MS: raw.AUTH_TIMEOUT_MS,
    MCP_API_KEY_PEPPER: pepper,
    CORS_ORIGINS: dedupe([
      ...splitCsv(raw.CORS_ORIGIN),
      ...splitCsv(raw.APP_ORIGIN),
      ...splitCsv(raw.FRONTEND_URL),
      ...splitCsv(raw.WEB_CLIENT_URL),
      ...splitCsv(raw.FRONTEND_ORIGIN),
    ]),
    MCP_AUTH0_DOMAIN: normalizeAuth0Domain(raw.MCP_AUTH0_DOMAIN),
    MCP_AUTH0_AUDIENCES: dedupe([
      ...splitCsv(raw.MCP_AUTH0_AUDIENCE),
      ...splitCsv(raw.MCP_AUTH0_AUDIENCE_ALT),
    ]),
    MCP_AUTH0_ISSUER: raw.MCP_AUTH0_ISSUER ?? null,
    MCP_PUBLIC_BASE_URL: raw.MCP_PUBLIC_BASE_URL ?? null,
    MCP_AUTH0_SUPPORTED_SCOPES:
      splitCsv(raw.MCP_AUTH0_SUPPORTED_SCOPES).length > 0
        ? splitCsv(raw.MCP_AUTH0_SUPPORTED_SCOPES)
        : ['tasks:read', 'tasks:write'],
    TRUST_PROXY: raw.TRUST_PROXY ?? null,
    WEB_DIST_DIR: raw.WEB_DIST_DIR ?? null,
  };
}

let cached: Env | null = null;

/**
 * Load the process environment exactly once (dotenv applied outside production).
 */
export function loadEnv(): Env {
  if (cached) return cached;
  if (process.env.NODE_ENV !== 'production') {
    // Dev/test convenience only; production reads real environment variables.
    dotenv.config({ quiet: true });
  }
  cached = parseEnv(process.env);
  return cached;
}
