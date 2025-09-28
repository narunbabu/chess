// src/config.js
export const BASE_URL = process.env.REACT_APP_BACKEND_URL?.replace('/api', '') ||
  (process.env.NODE_ENV === 'production'
    ? "https://learn.ameyem.com"
    : "http://localhost:8000");

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || `${BASE_URL}/api`;
