import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';

/**
 * Resolve the server package version. Works from both src (tsx) and dist
 * (node) since both sit two directories below apps/server.
 */
export function readPackageVersion(): string {
  try {
    const packageJsonPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
      '..',
      'package.json',
    );
    const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: unknown };
    return typeof parsed.version === 'string' ? parsed.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Public GET /api/v1/info — advertises guest mode ('local-only'). */
export function createInfoRouter(version: string): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    res.json({
      name: 'Lifeline API',
      version,
      guestMode: 'local-only',
      time: new Date().toISOString(),
    });
  });
  return router;
}
