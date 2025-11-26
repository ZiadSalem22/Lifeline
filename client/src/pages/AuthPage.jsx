import Auth from '../components/auth/Auth';
import { useAuth } from '../hooks/useAuth';
import { Navigate, useNavigate } from 'react-router-dom';

const AuthPage = ({ onBack }) => {
  const { isAuthenticated, loginWithRedirect } = useAuth();
  const navigate = useNavigate();

  const handleBack = () => {
    if (typeof onBack === 'function') {
      onBack();
      return;
    }
    navigate('/');
  };

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <section style={{ padding: '32px 0' }}>
      <Auth onBack={handleBack} onAuthAction={() => loginWithRedirect()} />
    </section>
  );
};

export default AuthPage;
