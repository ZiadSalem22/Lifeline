import React from 'react';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import styles from './AppLayout.module.css';

const AppLayout = ({ children, sidebarProps = {}, topBarProps = {} }) => {
  return (
    <div className={styles['app-root']}>
      <Sidebar {...sidebarProps} />
      <div className={styles['main-content']}>
        <TopBar {...topBarProps} />
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
};

export default AppLayout;
