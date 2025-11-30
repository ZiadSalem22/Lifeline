import React from 'react';
import AppLayout from '../components/layout/AppLayout';
import ProfilePanel from '../components/ProfilePanel.jsx';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';

export default function ProfilePage({ sidebarProps = {}, topBarProps = {} }) {
  return (
    <AppLayout sidebarProps={sidebarProps} topBarProps={topBarProps}>
      <div style={{ display:'flex', justifyContent:'flex-start', alignItems:'flex-start', paddingTop:'0', paddingBottom:'12px', marginTop:'-32px' }}>
        <div style={{ width:'100%', maxWidth: 900, marginLeft: '0' }}>
          <ProtectedRoute>
            <ProfilePanel />
          </ProtectedRoute>
        </div>
      </div>
    </AppLayout>
  );
}
