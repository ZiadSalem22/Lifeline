import dotenv from 'dotenv';

const envFile = process.env.NODE_ENV === 'development' ? '.env.local' : '.env';
dotenv.config({ path: envFile });

function splitCsv(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parsePort(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseTimeout(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed >= 100 ? parsed : fallback;
}

export function loadConfig(env = process.env) {
  const host = String(env.MCP_BIND_HOST || '127.0.0.1');
  const publicBaseUrl = String(env.MCP_PUBLIC_BASE_URL || '').trim();

  return Object.freeze({
    serviceName: 'lifeline-mcp',
    serviceVersion: '0.1.0',
    host,
    port: parsePort(env.MCP_PORT || env.PORT, 3030),
    publicBaseUrl: publicBaseUrl || null,
    allowedHosts: splitCsv(env.MCP_ALLOWED_HOSTS),
    backendBaseUrl: String(env.LIFELINE_BACKEND_BASE_URL || 'http://127.0.0.1:3000'),
    internalSharedSecret: String(env.MCP_INTERNAL_SHARED_SECRET || ''),
    requestTimeoutMs: parseTimeout(env.MCP_REQUEST_TIMEOUT_MS, 5000),
    logLevel: String(env.MCP_LOG_LEVEL || 'info'),
  });
}
