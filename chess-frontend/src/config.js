// src/config.js
const backend = process.env.REACT_APP_BACKEND_URL;

export const BACKEND_URL = backend || 
  (process.env.NODE_ENV === 'production'
    ? "https://api.chess99.com/api"
    : "http://localhost:8000/api");

export const BASE_URL = BACKEND_URL.replace(/\/api$/, '');
