import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '../styles/base.css'
import '../styles/globals.css'
import '../styles/design/colors.css'
import '../styles/design/typography.css'
import '../styles/design/spacing.css'
import '../styles/design/breakpoints.css'
import '../styles/utils.css'
import App from './App.jsx'
import ErrorBoundary from '../components/common/ErrorBoundary.jsx'
import { LoadingProvider } from '../context/LoadingContext';
import LoadingOverlay from '../components/ui/LoadingOverlay';
import { AuthAdapterProvider } from '../providers/AuthAdapterProvider.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthAdapterProvider>
      <BrowserRouter
        basename="/"
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ErrorBoundary>
          <LoadingProvider>
            <App />
            <LoadingOverlay />
          </LoadingProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </AuthAdapterProvider>
  </StrictMode>,
)
