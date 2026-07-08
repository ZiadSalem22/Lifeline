import { useEffect } from 'react';
import { Navigate } from 'react-router';
import { Spinner } from '../../shared/ui/Spinner';
import { useAuth } from '../providers/auth-context';
import styles from './AuthPage.module.css';

/** Redirect-only page: sends the visitor to the hosted login (old AuthPage). */
export default function AuthPage() {
  const { currentUser, checkedIdentity, loading, login } = useAuth();

  useEffect(() => {
    if (checkedIdentity && !loading && !currentUser) {
      void login();
    }
  }, [checkedIdentity, loading, currentUser, login]);

  if (currentUser) return <Navigate to="/" replace />;

  return (
    <div className={styles.wrap}>
      <Spinner size={40} label="Redirecting to sign in" />
      <p className={styles.text}>Redirecting to sign in…</p>
    </div>
  );
}
