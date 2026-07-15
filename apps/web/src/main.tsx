import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import './shared/styles/tokens.css';
import './shared/styles/globals.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Installable PWA shell (prod only — the dev server must never be cached).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // updateViaCache 'none': the worker script itself must always be fetched
    // from the network — an HTTP-cached sw.js pins clients to an old shell.
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
      // Offline shell is progressive enhancement — never block the app on it.
    });
  });
}
