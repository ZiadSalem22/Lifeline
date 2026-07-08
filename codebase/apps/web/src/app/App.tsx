import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
// Root export (not 'react-router/dom') so the provider and hooks always share
// one module instance — the /dom subpath resolves to a second copy under
// vitest's CJS interop and breaks the router context.
import { RouterProvider } from 'react-router';
import { queryClient } from '../shared/api/query-client';
import { ErrorBoundary } from './ErrorBoundary';
import { AuthAdapterProvider } from './providers/auth-adapter';
import { AuthProvider } from './providers/auth-provider';
import { ThemeProvider } from './providers/theme-provider';
import { createAppRouter } from './router';

export default function App() {
  const [router] = useState(createAppRouter);

  return (
    <ErrorBoundary>
      <AuthAdapterProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ThemeProvider>
              <RouterProvider router={router} />
            </ThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </AuthAdapterProvider>
    </ErrorBoundary>
  );
}
