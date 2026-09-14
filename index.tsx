import React from 'react';
import ReactDOM from 'react-dom/client';
import './services/registerDbV6.js';
import App from './App';

if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = (async (input, init) => {
    const response = await originalFetch(input, init);
    if (response.status === 401) {
      const url = typeof input === 'string' 
        ? input 
        : (input instanceof Request ? input.url : String(input));
      if (url && !url.includes('/api/auth-login')) {
        localStorage.removeItem('rafiq_app_unlocked');
        window.location.reload();
      }
    }
    return response;
  }) as typeof window.fetch;
}


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

const isProductionBuild = Boolean((import.meta as any).env?.PROD);
const isLocalhost = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
);

if ('serviceWorker' in navigator && isProductionBuild && !isLocalhost) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.warn('Service worker registration failed:', error);
    });
  });
} else {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(registrations => registrations.forEach(registration => registration.unregister()))
      .catch(error => {
        console.warn('Service worker cleanup failed:', error);
      });
  }
  if (typeof window !== 'undefined' && 'caches' in window) {
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .catch(error => {
        console.warn('Cache storage cleanup failed:', error);
      });
  }
}

