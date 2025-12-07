import React, { useEffect, useRef, useState } from 'react';
import { getPendingNotifications } from '../utils/api';
import { useApi } from '../hooks/useApi';
import { useAuthContext } from './AuthProvider';

export default function NotificationPoller() {
  // Notifications temporarily disabled to stop outbound polling calls.
  // Keep a no-op component so callers don't need changes.
  return null;
}
