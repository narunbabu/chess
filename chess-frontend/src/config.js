// src/config.js
export const BASE_URL = process.env.NODE_ENV === 'production'
  ? "https://learn.ameyem.com"
  : "http://127.0.0.1:8000";

export const BACKEND_URL = `${BASE_URL}/api`;
