const logger = require('../config/logger');

const isProduction = process.env.NODE_ENV === 'production';

// Timeout for the entire auth middleware lifecycle (covers DNS + socket + TLS + response)
const AUTH_TIMEOUT_MS = parseInt(process.env.AUTH_TIMEOUT_MS, 10) || 10_000;

// --- Auth readiness tracking ---
const authReadiness = {
  jwksWarmedUp: false,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastFailureReason: null,
  consecutiveFailures: 0,
};

function recordAuthSuccess() {
  authReadiness.lastSuccessAt = Date.now();
  authReadiness.consecutiveFailures = 0;
}

function recordAuthFailure(reason) {
  authReadiness.lastFailureAt = Date.now();
  authReadiness.lastFailureReason = reason;
  authReadiness.consecutiveFailures += 1;
}

function getAuthReadiness() {
  if (process.env.AUTH_DISABLED === '1') {
    return { ready: true, bypassed: true };
  }
  const degraded = authReadiness.consecutiveFailures >= 3;
  return {
    ready: authReadiness.jwksWarmedUp && !degraded,
    jwksWarmedUp: authReadiness.jwksWarmedUp,
    degraded,
    consecutiveFailures: authReadiness.consecutiveFailures,
    lastSuccessAt: authReadiness.lastSuccessAt ? new Date(authReadiness.lastSuccessAt).toISOString() : null,
    lastFailureAt: authReadiness.lastFailureAt ? new Date(authReadiness.lastFailureAt).toISOString() : null,
    lastFailureReason: authReadiness.lastFailureReason,
  };
}

// Minimal HTTPS GET with a destroy-based timeout that covers the full request
// lifecycle: DNS + socket + TLS + response. Unlike http.get({timeout}) which
// only covers socket idle time after the socket already exists.
function fetchJsonWithTimeout(url, timeoutMs) {
  const https = require('https');
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      req.destroy(new Error(`JWKS fetch timed out after ${timeoutMs}ms (url: ${url})`));
    }, timeoutMs);

    const req = https.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        clearTimeout(timer);
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString()));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}`));
        }
      });
    });

    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// Build issuer URL (used by both warm-up and auth middleware)
const configuredDomain = process.env.AUTH0_DOMAIN?.replace(/^https?:\/\//, '').replace(/\/$/, '') || '';
const AUTH0_DOMAIN = configuredDomain || 'dev-1b4upl01bjz8l8li.us.auth0.com';
const issuerBaseURL = `https://${AUTH0_DOMAIN}`;

// Eagerly fetch OIDC discovery + JWKS on startup so the library cache is
// populated before the first user request. Reduces the window where a cold
// cache + DNS issue can block authenticated traffic.
async function warmUpAuth() {
  if (process.env.AUTH_DISABLED === '1') return;

  const discoveryUrl = `${issuerBaseURL}/.well-known/openid-configuration`;
  try {
    logger.info('[auth0] pre-warming JWKS - fetching OIDC discovery', { url: discoveryUrl });
    const discovery = await fetchJsonWithTimeout(discoveryUrl, AUTH_TIMEOUT_MS);
    const jwksUri = discovery.jwks_uri;
    if (jwksUri) {
      logger.info('[auth0] pre-warming JWKS - fetching JWKS', { url: jwksUri });
      await fetchJsonWithTimeout(jwksUri, AUTH_TIMEOUT_MS);
    }
    authReadiness.jwksWarmedUp = true;
    logger.info('[auth0] JWKS pre-warm complete');
  } catch (err) {
    authReadiness.jwksWarmedUp = false;
    logger.warn('[auth0] JWKS pre-warm failed - auth may be slow on first request', {
      error: err.message,
      discoveryUrl,
    });
  }
}

// --- Build the checkJwt middleware ---
function buildCheckJwt() {
  if (process.env.AUTH_DISABLED === '1') {
    return (req, res, next) => next();
  }

  const { auth } = require('express-oauth2-jwt-bearer');

  const configuredAudience = process.env.AUTH0_AUDIENCE || '';
  const configuredAudienceAlt = process.env.AUTH0_AUDIENCE_ALT || '';

  if (isProduction && (!configuredDomain || !(configuredAudience || configuredAudienceAlt).trim())) {
    throw new Error('AUTH0_DOMAIN and AUTH0_AUDIENCE (or AUTH0_AUDIENCE_ALT) are required when AUTH_DISABLED is not enabled in production');
  }

  const audRaw = (configuredAudience || 'https://lifeline-api').split(',');
  const audAlt = configuredAudienceAlt.split(',');
  const AUTH0_AUDIENCE = [...audRaw, ...audAlt].map(a => a.trim()).filter(Boolean);

  const baseAuth = auth({
    issuerBaseURL,
    audience: AUTH0_AUDIENCE.length <= 1 ? AUTH0_AUDIENCE[0] : AUTH0_AUDIENCE,
    tokenSigningAlg: 'RS256',
  });

  // Wrap the base auth middleware with a full-lifecycle timeout so that a hung
  // JWKS fetch (e.g. from DNS resolution blocking before socket creation)
  // cannot block indefinitely. Covers DNS + TCP + TLS + response.
  return function checkJwtWithTimeout(req, res, next) {
    let settled = false;
    const start = Date.now();

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      const elapsed = Date.now() - start;
      recordAuthFailure('timeout');
      logger.error('[auth0] auth middleware timed out', {
        path: req.path,
        method: req.method,
        elapsed,
        timeoutMs: AUTH_TIMEOUT_MS,
      });
      if (!res.headersSent) {
        res.status(503).json({ error: 'Authentication service temporarily unavailable' });
      }
    }, AUTH_TIMEOUT_MS);

    baseAuth(req, res, (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const elapsed = Date.now() - start;

      if (err) {
        if (elapsed > 2000) {
          logger.warn('[auth0] auth middleware slow', { path: req.path, elapsed });
        }
        if (err.status !== 401) {
          recordAuthFailure(err.message || 'auth-error');
        }
        return next(err);
      }

      recordAuthSuccess();
      if (elapsed > 2000) {
        logger.warn('[auth0] auth middleware slow but succeeded', { path: req.path, elapsed });
      }
      return next();
    });
  };
}

const checkJwt = buildCheckJwt();

module.exports = { checkJwt, warmUpAuth, getAuthReadiness };
