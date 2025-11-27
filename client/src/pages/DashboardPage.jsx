import { useEffect, useState } from 'react';
import CosmicBackground from '../components/background/CosmicBackground';
import { Sidebar, TopBar } from '../components/layout';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../hooks/useApi';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
if (!API_BASE_URL) {
  throw new Error('VITE_API_BASE_URL is not defined');
}
const API_BASE = API_BASE_URL.replace(/\/$/, '');

const DashboardPage = ({ sidebarProps, topBarProps, children, showBackground = false }) => {
  const { isAuthenticated } = useAuth();
  const { fetchWithAuth } = useApi();
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      try {
        const response = await fetchWithAuth(`${API_BASE}/me`);
        if (!response.ok) {
          throw new Error(`API error ${response.status}`);
        }
        const data = await response.json();
        if (!cancelled) {
          setMe(data);
          setError(null);
        }
      } catch (err) {
        console.error('Error calling /api/me:', err);
        if (!cancelled) {
          setError(err.message);
        }
      }
    };

    // Note: In React 18 StrictMode, effects run twice in development,
    // so this may trigger /api/me twice in dev. This does not happen
    // in production builds.
    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [fetchWithAuth, isAuthenticated]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'transparent', position: 'relative', overflow: 'hidden' }}>
      {showBackground && <CosmicBackground />}
      <Sidebar {...sidebarProps} />
      <TopBar {...topBarProps} />
      <main className="main-content" style={{ paddingTop: '120px' }}>
        {children}
        {me && (
          <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '1rem' }}>
            <div>Authenticated as: {me.sub}</div>
            {me.scope && <div>Scopes: {me.scope}</div>}
          </div>
        )}
        {error && (
          <div style={{ fontSize: '12px', color: 'red', marginTop: '1rem' }}>
            API error: {error}
          </div>
        )}
      </main>
    </div>
  );
};

export default DashboardPage;
