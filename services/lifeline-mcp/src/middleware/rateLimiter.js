const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 120;

const windows = new Map();

function cleanupStaleEntries() {
  const now = Date.now();
  for (const [key, entry] of windows) {
    if (now - entry.start > WINDOW_MS * 2) {
      windows.delete(key);
    }
  }
}

setInterval(cleanupStaleEntries, WINDOW_MS * 5).unref();

export function rateLimitMiddleware(req, res, next) {
  const principalId = req.headers['x-mcp-principal-user-id'] || req.headers['x-mcp-subject-id'] || 'anonymous';
  const now = Date.now();
  let entry = windows.get(principalId);

  if (!entry || now - entry.start > WINDOW_MS) {
    entry = { start: now, count: 0 };
    windows.set(principalId, entry);
  }

  entry.count += 1;

  if (entry.count > MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((entry.start + WINDOW_MS - now) / 1000);
    res.set('Retry-After', String(Math.max(retryAfter, 1)));
    return res.status(429).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Too many requests. Please retry later.',
        data: { code: 'rate_limited', status: 429 },
      },
      id: null,
    });
  }

  return next();
}
