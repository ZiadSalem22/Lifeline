const { auth } = require('express-oauth2-jwt-bearer');

// Configure Auth0 based on the values actually present in the tokens.
// You can override these with environment variables, but the defaults
// are aligned with the frontend Auth0 setup.
const AUTH0_DOMAIN =
  process.env.AUTH0_DOMAIN || 'dev-1b4upl01bjz8l8li.us.auth0.com';

// Your access token's "aud" claim is an array containing both
// the API audience and the Auth0 userinfo audience. Allow either.
const EXPECTED_AUDIENCES = [
  process.env.AUTH0_AUDIENCE || 'https://lifeline-api',
  `https://${AUTH0_DOMAIN}/userinfo`,
];

// express-oauth2-jwt-bearer uses Auth0 JWKS under the hood with
// caching and rate limiting.
const issuerBaseURL = `https://${AUTH0_DOMAIN}/`;

const checkJwt = auth({
  issuerBaseURL,
  audience: EXPECTED_AUDIENCES,
  tokenSigningAlg: 'RS256',
});

module.exports = { checkJwt };
