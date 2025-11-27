const { AppError } = require('../utils/errors');

function createRateLimiter({ windowMs, max, keyGenerator, exempt }) {
  const buckets = new Map(); // key -> { count, reset }

  function now() {
    return Date.now();
  }

  return function rateLimit(req, res, next) {
    try {
      if (typeof exempt === 'function' && exempt(req)) {
        return next();
      }
      const key = (typeof keyGenerator === 'function')
        ? keyGenerator(req)
        : (req.currentUser && req.currentUser.id) || req.ip;

      const current = now();
      const bucket = buckets.get(key) || { count: 0, reset: current + windowMs };

      if (current > bucket.reset) {
        bucket.count = 0;
        bucket.reset = current + windowMs;
      }

      bucket.count += 1;
      buckets.set(key, bucket);

      const remaining = Math.max(0, max - bucket.count);
      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.floor(bucket.reset / 1000).toString());

      if (bucket.count > max) {
        return next(new AppError('Rate limit exceeded', 429));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { createRateLimiter };
