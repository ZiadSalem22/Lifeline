const DEFAULT_API_BASE = '/';

export function getConfiguredApiBase() {
  const configured = import.meta.env.VITE_API_BASE_URL;
  return configured && String(configured).trim() ? String(configured).trim() : DEFAULT_API_BASE;
}

export function getNormalizedApiBase() {
  const raw = getConfiguredApiBase().replace(/\/$/, '');
  if (!raw) {
    return '/api';
  }
  return raw.endsWith('/api') ? raw : `${raw}/api`;
}

export function buildApiUrl(input) {
  const path = String(input || '').startsWith('/') ? String(input) : `/${String(input || '')}`;
  const cleaned = path.replace(/^\/api/, '');
  return `${getNormalizedApiBase()}${cleaned}`;
}

export function resolveApiUrl(input) {
  if (!input) {
    throw new Error('resolveApiUrl requires a path or URL');
  }
  if (/^https?:\/\//i.test(input)) {
    return input;
  }
  return buildApiUrl(input);
}

export function isClientAuthDisabled() {
  return import.meta.env.VITE_AUTH_DISABLED === '1';
}