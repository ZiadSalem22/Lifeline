import React from 'react';
import TopBar from './TopBar';
import Sidebar from './Sidebar';

const AppLayout = ({ children, sidebarProps = {}, topBarProps = {} }) => {
  return (
    <div className="app-root" style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar {...sidebarProps} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopBar {...topBarProps} />
        <main style={{ padding: '28px', flex: 1 }}>{children}</main>
      </div>
    </div>
  );
};

export default AppLayout;
