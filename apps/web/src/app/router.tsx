import { createBrowserRouter, Navigate } from 'react-router';
import { AppLayout } from './layout/AppLayout';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import OnboardingPage from './pages/OnboardingPage';
import ProfilePage from './pages/ProfilePage';
import SearchPage from './pages/SearchPage';
import StatisticsPage from './pages/StatisticsPage';
import ReviewPage from './pages/ReviewPage';
import { RequireAuth, RequireOnboarded } from './route-guards';

export function createAppRouter() {
  return createBrowserRouter([
    { path: '/auth', element: <AuthPage /> },
    {
      element: <RequireAuth />,
      children: [{ path: '/onboarding', element: <OnboardingPage /> }],
    },
    {
      path: '/',
      element: <AppLayout />,
      children: [
        {
          element: <RequireOnboarded />,
          children: [
            { index: true, element: <DashboardPage /> },
            { path: 'day/:day', element: <DashboardPage /> },
            { path: 'search', element: <SearchPage /> },
            { path: 'advanced-search', element: <SearchPage /> },
            { path: 'statistics', element: <StatisticsPage /> },
            { path: 'review', element: <ReviewPage /> },
            { path: 'review/:weekStart', element: <ReviewPage /> },
            { path: 'stats', element: <StatisticsPage /> },
            {
              element: <RequireAuth />,
              children: [{ path: 'profile', element: <ProfilePage /> }],
            },
          ],
        },
      ],
    },
    { path: '*', element: <Navigate to="/" replace /> },
  ]);
}
