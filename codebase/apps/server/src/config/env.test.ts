import { describe, expect, it } from 'vitest';
import { DEV_DATABASE_URL, normalizeAuth0Domain, parseEnv } from './env.js';

const PROD_BASE = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://prod:prod@db:5432/lifeline',
  AUTH0_DOMAIN: 'tenant.us.auth0.com',
  AUTH0_AUDIENCE: 'https://lifeline-api',
  MCP_API_KEY_PEPPER: 'pepper-value',
};

describe('parseEnv', () => {
  it('applies dev defaults', () => {
    const env = parseEnv({});
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
    expect(env.LOG_LEVEL).toBe('debug');
    expect(env.DATABASE_URL).toBe(DEV_DATABASE_URL);
    expect(env.AUTH_LOCAL_USER_ID).toBe('guest-local');
    expect(env.AUTH_TIMEOUT_MS).toBe(10_000);
    expect(env.AUTH_DISABLED).toBe(false);
    expect(env.MCP_AUTH0_SUPPORTED_SCOPES).toEqual(['tasks:read', 'tasks:write']);
  });

  it('defaults LOG_LEVEL to info outside development', () => {
    expect(parseEnv({ NODE_ENV: 'test' }).LOG_LEVEL).toBe('info');
    expect(parseEnv(PROD_BASE).LOG_LEVEL).toBe('info');
  });

  it('accepts a fully-configured production environment', () => {
    const env = parseEnv(PROD_BASE);
    expect(env.AUTH0_DOMAIN).toBe('tenant.us.auth0.com');
    expect(env.AUTH0_AUDIENCES).toEqual(['https://lifeline-api']);
    expect(env.MCP_API_KEY_PEPPER).toBe('pepper-value');
  });

  it('production requires DATABASE_URL', () => {
    const { DATABASE_URL: _omitted, ...rest } = PROD_BASE;
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it('production requires AUTH0_DOMAIN and AUTH0_AUDIENCE', () => {
    const { AUTH0_DOMAIN: _d, ...noDomain } = PROD_BASE;
    expect(() => parseEnv(noDomain)).toThrow(/AUTH0_DOMAIN/);
    const { AUTH0_AUDIENCE: _a, ...noAudience } = PROD_BASE;
    expect(() => parseEnv(noAudience)).toThrow(/AUTH0_AUDIENCE/);
  });

  it('production requires a non-empty MCP_API_KEY_PEPPER', () => {
    expect(() => parseEnv({ ...PROD_BASE, MCP_API_KEY_PEPPER: '' })).toThrow(/MCP_API_KEY_PEPPER/);
    expect(() => parseEnv({ ...PROD_BASE, MCP_API_KEY_PEPPER: '   ' })).toThrow(
      /MCP_API_KEY_PEPPER/,
    );
    const { MCP_API_KEY_PEPPER: _p, ...noPepper } = PROD_BASE;
    expect(() => parseEnv(noPepper)).toThrow(/MCP_API_KEY_PEPPER/);
  });

  it('AUTH_DISABLED=1 relaxes the production auth requirements (but not DATABASE_URL)', () => {
    const env = parseEnv({
      NODE_ENV: 'production',
      DATABASE_URL: PROD_BASE.DATABASE_URL,
      AUTH_DISABLED: '1',
    });
    expect(env.AUTH_DISABLED).toBe(true);
    expect(env.AUTH0_DOMAIN).toBeNull();
    expect(() => parseEnv({ NODE_ENV: 'production', AUTH_DISABLED: '1' })).toThrow(/DATABASE_URL/);
  });

  it('normalizes AUTH0_DOMAIN (protocol + trailing slash stripped)', () => {
    const env = parseEnv({ AUTH0_DOMAIN: 'https://tenant.eu.auth0.com/' });
    expect(env.AUTH0_DOMAIN).toBe('tenant.eu.auth0.com');
    expect(normalizeAuth0Domain('http://x.auth0.com//')).toBe('x.auth0.com');
    expect(normalizeAuth0Domain(undefined)).toBeNull();
    expect(normalizeAuth0Domain('   ')).toBeNull();
  });

  it('merges audience CSVs and dedupes', () => {
    const env = parseEnv({
      AUTH0_AUDIENCE: 'https://a, https://b',
      AUTH0_AUDIENCE_ALT: 'https://b,https://c',
    });
    expect(env.AUTH0_AUDIENCES).toEqual(['https://a', 'https://b', 'https://c']);
  });

  it('honors legacy CORS origin vars alongside CORS_ORIGIN', () => {
    const env = parseEnv({
      CORS_ORIGIN: 'https://app.example.com',
      APP_ORIGIN: 'https://legacy-a.example.com',
      FRONTEND_URL: 'https://legacy-b.example.com',
      WEB_CLIENT_URL: 'https://legacy-c.example.com',
      FRONTEND_ORIGIN: 'https://app.example.com',
    });
    expect(env.CORS_ORIGINS).toEqual([
      'https://app.example.com',
      'https://legacy-a.example.com',
      'https://legacy-b.example.com',
      'https://legacy-c.example.com',
    ]);
  });

  it('parses MCP settings with defaults', () => {
    const env = parseEnv({
      MCP_AUTH0_DOMAIN: 'https://mcp-tenant.auth0.com/',
      MCP_AUTH0_AUDIENCE: 'https://mcp',
      MCP_AUTH0_SUPPORTED_SCOPES: 'tasks:read',
    });
    expect(env.MCP_AUTH0_DOMAIN).toBe('mcp-tenant.auth0.com');
    expect(env.MCP_AUTH0_AUDIENCES).toEqual(['https://mcp']);
    expect(env.MCP_AUTH0_SUPPORTED_SCOPES).toEqual(['tasks:read']);
    expect(env.MCP_PUBLIC_BASE_URL).toBeNull();
    expect(env.MCP_AUTH0_ISSUER).toBeNull();
  });

  it('rejects an invalid NODE_ENV and PORT', () => {
    expect(() => parseEnv({ NODE_ENV: 'staging' })).toThrow();
    expect(() => parseEnv({ PORT: 'not-a-number' })).toThrow();
  });
});
