/**
 * Fixed-window per-principal rate limiter for POST /mcp, ported from the old
 * `services/lifeline-mcp/src/middleware/rateLimiter.js` with the keying bug
 * fixed (audit-mcp.md §8.1): the old limiter keyed on inbound headers nothing
 * ever set, so ALL traffic shared one `anonymous` bucket. This limiter is
 * invoked AFTER authentication and keys on `subjectType:subjectId`.
 *
 * Stale buckets are pruned inline on each hit (no interval timer to leak).
 */

export interface McpRateLimitOptions {
  /** Requests allowed per window. Default 120 (old parity). */
  limit?: number | undefined;
  /** Window size in milliseconds. Default 60s (old parity). */
  windowMs?: number | undefined;
  now?: (() => number) | undefined;
}

export interface RateLimitDecision {
  allowed: boolean;
  /** Seconds until the window resets (≥1); set only when blocked. */
  retryAfterSeconds?: number;
}

interface WindowEntry {
  start: number;
  count: number;
}

export interface McpRateLimiter {
  hit(key: string): RateLimitDecision;
}

export function createMcpRateLimiter(options: McpRateLimitOptions = {}): McpRateLimiter {
  const limit = options.limit ?? 120;
  const windowMs = options.windowMs ?? 60_000;
  const now = options.now ?? (() => Date.now());
  const windows = new Map<string, WindowEntry>();

  function pruneStale(currentTime: number): void {
    for (const [key, entry] of windows) {
      if (currentTime - entry.start > windowMs * 2) windows.delete(key);
    }
  }

  return {
    hit(key: string): RateLimitDecision {
      const currentTime = now();
      pruneStale(currentTime);

      let entry = windows.get(key);
      if (entry === undefined || currentTime - entry.start > windowMs) {
        entry = { start: currentTime, count: 0 };
        windows.set(key, entry);
      }

      entry.count += 1;
      if (entry.count > limit) {
        const retryAfterSeconds = Math.max(
          Math.ceil((entry.start + windowMs - currentTime) / 1000),
          1,
        );
        return { allowed: false, retryAfterSeconds };
      }
      return { allowed: true };
    },
  };
}
