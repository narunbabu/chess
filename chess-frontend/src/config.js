// src/config.js
export const BACKEND_URL = process.env.NODE_ENV === 'production'
  ? "https://learn.ameyem.com/api"
  : "http://127.0.0.1:8000";
