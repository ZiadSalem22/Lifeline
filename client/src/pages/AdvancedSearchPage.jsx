import React from 'react';
import AppLayout from '../components/layout/AppLayout';
import AdvancedSearch from '../components/search/AdvancedSearch';

const AdvancedSearchPage = ({ sidebarProps = {}, topBarProps = {}, searchProps = {} }) => {
  return (
    <AppLayout sidebarProps={sidebarProps} topBarProps={topBarProps}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 80px)' }}>
        <div style={{ width: '100%', maxWidth: 900 }}>
          <AdvancedSearch {...searchProps} />
        </div>
      </div>
    </AppLayout>
  );
};

export default AdvancedSearchPage;
