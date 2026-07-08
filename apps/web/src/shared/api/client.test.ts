import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression guard for the API base URL. VITE_API_BASE_URL='/' (the normal
 * production value) must NOT produce '//api/v1' — a protocol-relative URL the
 * browser resolves to the host 'api', failing every request with a DNS error.
 */
describe('API_BASE_URL', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function baseFor(value: string): Promise<string> {
    vi.resetModules();
    vi.stubEnv('VITE_API_BASE_URL', value);
    const mod = await import('./client');
    return mod.API_BASE_URL;
  }

  it("normalizes '/' to a same-origin path (no protocol-relative '//')", async () => {
    const base = await baseFor('/');
    expect(base).toBe('/api/v1');
    expect(base.startsWith('//')).toBe(false);
  });

  it('treats an empty base as same-origin', async () => {
    expect(await baseFor('')).toBe('/api/v1');
  });

  it('preserves a full origin and strips a trailing slash', async () => {
    expect(await baseFor('http://localhost:3000')).toBe('http://localhost:3000/api/v1');
    expect(await baseFor('http://localhost:3000/')).toBe('http://localhost:3000/api/v1');
  });
});
