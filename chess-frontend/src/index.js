import './sentry';

import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';
import App from './App';

// Disable service worker to prevent cache errors
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
      console.log('Service Worker unregistered');
    }
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  // StrictMode disabled to prevent double score updates in development
  // TODO: Re-enable after implementing proper deduplication
  // <React.StrictMode>
    <HelmetProvider>
      <Sentry.ErrorBoundary fallback={<p style={{color:'#fff',textAlign:'center',marginTop:'40vh'}}>Something went wrong. Please refresh the page.</p>}>
        <App />
      </Sentry.ErrorBoundary>
    </HelmetProvider>
  // </React.StrictMode>
);