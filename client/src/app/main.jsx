import { StrictMode } from 'react'
import { Auth0Provider } from '@auth0/auth0-react';
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

const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
const scope = import.meta.env.VITE_AUTH0_SCOPE || 'openid profile email offline_access';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        audience,
        redirect_uri: window.location.origin,
        scope
      }}
      cacheLocation="localstorage"
      useRefreshTokens={true}
    >
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
    </Auth0Provider>
  </StrictMode>,
)
