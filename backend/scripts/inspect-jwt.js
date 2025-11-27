#!/usr/bin/env node
// Decode a JWT locally to inspect iss/aud/exp without verifying signature.
const token = process.argv[2];
if (!token) {
  console.error('Usage: node scripts/inspect-jwt.js <jwt>');
  process.exit(1);
}
try {
  const parts = token.split('.');
  if (parts.length < 2) throw new Error('Invalid JWT format');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  console.log('JWT Payload:', payload);
  if (payload.exp) {
    const expDate = new Date(payload.exp * 1000);
    console.log('Expires At (UTC):', expDate.toISOString());
  }
  console.log('issuer (iss):', payload.iss);
  console.log('audience (aud):', payload.aud);
  console.log('subject (sub):', payload.sub);
  console.log('email:', payload.email);
} catch (e) {
  console.error('Failed to decode token:', e.message);
  process.exit(1);
}