import { Navigate, Outlet } from 'react-router';
import { Spinner } from '../shared/ui/Spinner';
import { useAuth } from './providers/auth-context';

/** Gate: unauthenticated (guest) visitors are sent to /auth. */
export function RequireAuth() {
  const { checkedIdentity, loading, currentUser, guestMode } = useAuth();
  if (!checkedIdentity || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spinner size={44} />
      </div>
    );
  }
  if (guestMode || !currentUser) return <Navigate to="/auth" replace />;
  return <Outlet />;
}

/**
 * Gate: authenticated users without a completed profile are redirected to
 * /onboarding (old App.jsx did this via a global effect). Guests pass through.
 */
export function RequireOnboarded() {
  const { currentUser } = useAuth();
  if (currentUser && (currentUser.profile === null || !currentUser.profile.onboardingCompleted)) {
    return <Navigate to="/onboarding" replace />;
  }
  return <Outlet />;
}
