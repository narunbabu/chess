// // src/services/api.js

import axios from "axios";
import { BACKEND_URL } from "../config";

const api = axios.create({ baseURL: BACKEND_URL });

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const url = error.config?.url || '';
      // Don't redirect for auth endpoints — their 401 is an expected failure (wrong credentials)
      if (!url.includes('/auth/login') && !url.includes('/auth/register')) {
        localStorage.removeItem("auth_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
