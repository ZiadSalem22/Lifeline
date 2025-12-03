import React from 'react';
import AppLayout from '../components/layout/AppLayout';
import AdvancedSearch from '../components/search/AdvancedSearch';
import styles from './AdvancedSearchPage.module.css';

const AdvancedSearchPage = ({ sidebarProps = {}, topBarProps = {}, searchProps = {} }) => {
  return (
    <AppLayout sidebarProps={sidebarProps} topBarProps={topBarProps}>
      <div className={styles.page}>
        <div className={styles.container}>
          <AdvancedSearch {...searchProps} />
        </div>
      </div>
    </AppLayout>
  );
};

export default AdvancedSearchPage;
