import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useApi } from '../../hooks/useApi';
import { useLoading } from '../../context/LoadingContext';
import ApiKeysCard from './ApiKeysCard';
import ProfileDetailsCard from './ProfileDetailsCard';
import styles from './ProfilePanel.module.css';

export default function ProfilePanel() {
  const { isAuthenticated } = useAuth();
  const { fetchWithAuth } = useApi();
  const { isLoading: globalLoading } = useLoading();

  return (
    <div className={styles.panel}>
      <ProfileDetailsCard
        fetchWithAuth={fetchWithAuth}
        globalLoading={globalLoading}
        isAuthenticated={isAuthenticated}
      />
      <ApiKeysCard
        fetchWithAuth={fetchWithAuth}
        globalLoading={globalLoading}
        isAuthenticated={isAuthenticated}
      />
    </div>
  );
}
