import React from 'react';
import AppLayout from '../components/layout/AppLayout';
import ProfilePanel from '../components/ProfilePanel.jsx';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import styles from './ProfilePage.module.css';

export default function ProfilePage({ sidebarProps = {}, topBarProps = {} }) {
  return (
    <AppLayout sidebarProps={sidebarProps} topBarProps={topBarProps}>
      <div className={styles.page}>
        <div className={styles.container}>
          <ProtectedRoute>
            <ProfilePanel />
          </ProtectedRoute>
        </div>
      </div>
    </AppLayout>
  );
}
