import { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';

const AuthPage = () => {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth();

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      loginWithRedirect();
    }
  }, [isAuthenticated, isLoading, loginWithRedirect]);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div style={{ padding: '32px 0', textAlign: 'center' }}>
      <h2>Redirecting to login…</h2>
    </div>
  );
};

export default AuthPage;
