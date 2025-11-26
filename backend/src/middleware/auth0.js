const { auth } = require('express-oauth2-jwt-bearer');

const REQUIRED_ENV_VARS = ['AUTH0_DOMAIN', 'AUTH0_AUDIENCE'];
const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

if (missing.length) {
  throw new Error(`Missing Auth0 environment variables: ${missing.join(', ')}`);
}

const issuerBaseURL = process.env.AUTH0_ISSUER || `https://${process.env.AUTH0_DOMAIN}/`;

const checkJwt = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL,
  tokenSigningAlg: 'RS256'
});

module.exports = { checkJwt };
