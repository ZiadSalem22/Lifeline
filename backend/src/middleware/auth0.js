const { auth } = require('express-oauth2-jwt-bearer');
const logger = require('../config/logger');

// Required env vars
// AUTH0_DOMAIN should be just the domain (without protocol or trailing slash)
// AUTH0_AUDIENCE should match the access token's aud claim (API identifier or client id)
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN?.replace(/^https?:\/\//, '').replace(/\/$/, '') || 'dev-1b4upl01bjz8l8li.us.auth0.com';
// Support multiple audiences via comma-separated list or AUTH0_AUDIENCE_ALT
// Default to the API identifier so the backend validates API-scoped tokens by default
const audRaw = (process.env.AUTH0_AUDIENCE || 'https://lifeline-api').split(',');
const audAlt = (process.env.AUTH0_AUDIENCE_ALT || '').split(',');
const AUTH0_AUDIENCE = [...audRaw, ...audAlt].map(a => a.trim()).filter(Boolean);

// Build issuer URL for library (must include protocol, trailing slash optional but consistent)
const issuerBaseURL = `https://${AUTH0_DOMAIN}`; // library will normalize

// Strict audience: prefer single audience match to avoid accidental acceptance
const checkJwt = auth({
  issuerBaseURL,
  // express-oauth2-jwt-bearer accepts string or array for audience
  audience: AUTH0_AUDIENCE.length <= 1 ? AUTH0_AUDIENCE[0] : AUTH0_AUDIENCE,
  tokenSigningAlg: 'RS256',
});

// Diagnostic middleware to log failures (optional enable via AUTH0_DEBUG=1)
function authDebugWrapper(req, res, next) {
  if (process.env.AUTH0_DEBUG === '1') {
    const start = Date.now();
    const originalEnd = res.end;
    res.end = function (...args) {
      const status = res.statusCode;
      if (status === 401 || status === 403) {
        logger.warn('[auth0] JWT validation failed', {
          status,
          path: req.path,
          authHeader: req.headers.authorization ? 'present' : 'missing',
          domain: AUTH0_DOMAIN,
          audienceExpected: AUTH0_AUDIENCE,
        });
      }
      res.end = originalEnd;
      return res.end(...args);
    };
  }
  return checkJwt(req, res, next);
}

module.exports = { checkJwt: authDebugWrapper };
