import React from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Settings } from '../components/settings';

const SettingsPage = ({ sidebarProps = {}, topBarProps = {}, settingsProps = {} }) => {
  return (
    <AppLayout sidebarProps={sidebarProps} topBarProps={topBarProps}>
      <Settings {...settingsProps} />
    </AppLayout>
  );
};

export default SettingsPage;
