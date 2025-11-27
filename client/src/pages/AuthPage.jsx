
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';

const AuthPage = () => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Only show hello guest, let App.jsx render the dashboard/task UI
  return (
    <div style={{ padding: '32px 0', textAlign: 'center' }}>
      <h2>Hello guest</h2>
    </div>
  );
};

export default AuthPage;
