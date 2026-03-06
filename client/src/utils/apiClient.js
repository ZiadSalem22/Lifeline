import { buildApiUrl } from './apiBase';

const joinUrl = (path) => {
  return buildApiUrl(path);
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
