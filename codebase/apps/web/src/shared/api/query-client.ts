import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

/** Shared QueryClient: modest staleness, no focus refetch, no retry on auth/404. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) =>
        failureCount < 2 && ![401, 403, 404].includes(error instanceof ApiError ? error.status : 0),
    },
  },
});
