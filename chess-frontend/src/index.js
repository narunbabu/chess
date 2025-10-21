import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  // StrictMode disabled to prevent double score updates in development
  // TODO: Re-enable after implementing proper deduplication
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
);