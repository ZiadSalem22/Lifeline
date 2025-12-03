import React from 'react';
import AppLayout from '../components/layout/AppLayout';
import Statistics from '../components/statistics/Statistics';
import styles from './StatisticsPage.module.css';

const StatisticsPage = ({ sidebarProps = {}, topBarProps = {}, statsProps = {} }) => {
  return (
    <AppLayout sidebarProps={sidebarProps} topBarProps={topBarProps}>
      <div className={styles.page}>
        <div className={styles.container}>
          <Statistics {...statsProps} />
        </div>
      </div>
    </AppLayout>
  );
};

export default StatisticsPage;
