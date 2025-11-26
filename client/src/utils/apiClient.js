export function createApiClient(getAccessToken) {
  const baseUrl = "http://localhost:3000";

  async function get(path) {
    const token = await getAccessToken();
    const response = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API error ${response.status}`);
    }

    return response.json();
  }

  return {
    get,
  };
}
