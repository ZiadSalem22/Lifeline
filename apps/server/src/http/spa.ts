import path from 'node:path';
import express, { type RequestHandler } from 'express';

/**
 * Serve the built web SPA in production (single-container deploy). Static assets
 * are served from `webDistDir`; any other GET navigation falls back to
 * `index.html` so client-side routes (`/day/:date`, `/statistics`, …) resolve.
 *
 * The caller must mount this AFTER the API/MCP/health routes and gate it so it
 * never shadows them — unmatched `/api/*` must still reach the JSON 404 handler.
 */
export function createSpaHandler(webDistDir: string): RequestHandler {
  const resolvedDir = path.resolve(webDistDir);
  const indexHtml = path.join(resolvedDir, 'index.html');
  const staticMiddleware = express.static(resolvedDir, {
    index: false,
    // Vite fingerprints asset filenames, so they can be cached hard; index.html
    // (served by the fallback below) is not cached so deploys take effect.
    maxAge: '1y',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  });

  return (req, res, next) => {
    staticMiddleware(req, res, (staticErr) => {
      if (staticErr) {
        next(staticErr);
        return;
      }
      // No static asset matched. Only GET navigations get the SPA shell.
      if (req.method !== 'GET') {
        next();
        return;
      }
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml, (sendErr) => {
        if (sendErr) next(sendErr);
      });
    });
  };
}

/** Path prefixes that must never be served the SPA shell (API surface). */
export function isApiPath(pathname: string): boolean {
  return (
    pathname === '/health' ||
    pathname.startsWith('/health/') ||
    pathname === '/api' ||
    pathname.startsWith('/api/') ||
    pathname === '/mcp' ||
    pathname.startsWith('/mcp/') ||
    pathname.startsWith('/.well-known/')
  );
}
