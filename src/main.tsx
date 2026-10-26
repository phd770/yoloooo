import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const CLIENT_CACHE_VERSION = '2026-09-rebuild-2';

function clearStaleClientCache() {
  try {
    if (localStorage.getItem('dateapp_client_cache_version') === CLIENT_CACHE_VERSION) return;

    // Version updates must preserve conversations, preferences and unsent drafts.
    // Each cache reader validates its own data shape before using it.
    localStorage.setItem('dateapp_client_cache_version', CLIENT_CACHE_VERSION);
  } catch {
    // Storage may be unavailable in private browsing; the app still works online.
  }

  if ('caches' in window) {
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).catch(() => {});
  }
}

clearStaleClientCache();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch((error) => {
      console.log('ServiceWorker registration failed: ', error);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
