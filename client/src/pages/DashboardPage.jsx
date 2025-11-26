import { useEffect, useState } from 'react';
import CosmicBackground from '../components/background/CosmicBackground';
import { Sidebar, TopBar } from '../components/layout';
import { useAuth } from '../hooks/useAuth';
import { createApiClient } from '../utils/apiClient';

const DashboardPage = ({ sidebarProps, topBarProps, children, showBackground = false }) => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth();
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const api = createApiClient(() =>
      getAccessTokenSilently({
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
      })
    );

    api
      .get('/api/me')
      .then((data) => {
        setMe(data);
        console.log('API /api/me result:', data);
      })
      .catch((err) => {
        console.error('Error calling /api/me:', err);
        setError(err.message);
      });
  }, [isAuthenticated, getAccessTokenSilently]);

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
