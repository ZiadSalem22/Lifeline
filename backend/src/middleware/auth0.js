const { auth } = require('express-oauth2-jwt-bearer');
const logger = require('../config/logger');

// Required env vars
// AUTH0_DOMAIN should be just the domain (without protocol or trailing slash)
// AUTH0_AUDIENCE should match the access token's aud claim (API identifier or client id)
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN?.replace(/^https?:\/\//, '').replace(/\/$/, '') || 'dev-1b4upl01bjz8l8li.us.auth0.com';
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || '5THMMyQGm2mIbpLnCVW1RpXGIyd1G9jr';

// Build issuer URL for library (must include protocol, trailing slash optional but consistent)
const issuerBaseURL = `https://${AUTH0_DOMAIN}`; // library will normalize

// Strict audience: prefer single audience match to avoid accidental acceptance
const checkJwt = auth({
  issuerBaseURL,
  audience: AUTH0_AUDIENCE,
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
