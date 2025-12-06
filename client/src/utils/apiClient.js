const API_BASE_ENV = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_ENV) {
  throw new Error('VITE_API_BASE_URL is not defined');
}

// Normalize to ensure '/api' is included
const NORMALIZED_BASE = API_BASE_ENV.replace(/\/$/, '');
const API_BASE_URL = NORMALIZED_BASE.endsWith('/api') ? NORMALIZED_BASE : `${NORMALIZED_BASE}/api`;

const joinUrl = (path) => {
  const p = path.startsWith('/') ? path : `/${path}`;
  const cleaned = p.replace(/^\/api/, '');
  return `${API_BASE_URL}${cleaned}`;
};

export function createApiClient(fetchWithAuth) {
  if (typeof fetchWithAuth !== 'function') {
    throw new Error('createApiClient requires fetchWithAuth');
  }

  async function get(path) {
    const response = await fetchWithAuth(joinUrl(path));
    if (!response.ok) {
      console.log('API ERROR STATUS:', response.status, 'createApiClient.get');
      throw new Error(`API error ${response.status}`);
    }
    return response.json();
  }

  return {
    get,
  };
}
