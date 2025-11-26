import React from 'react';
import AppLayout from '../components/layout/AppLayout';
import Statistics from '../components/statistics/Statistics';

const StatisticsPage = ({ sidebarProps = {}, topBarProps = {}, statsProps = {} }) => {
  return (
    <AppLayout sidebarProps={sidebarProps} topBarProps={topBarProps}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 80px)' }}>
        <div style={{ width: '100%', maxWidth: 600 }}>
          <Statistics {...statsProps} />
        </div>
      </div>
    </AppLayout>
  );
};

export default StatisticsPage;
