// // src/services/api.js

import axios from "axios";
import { BACKEND_URL } from "../config";
import { isAuthHydrating } from "./authHydrationState";

const api = axios.create({ baseURL: BACKEND_URL });

// Dispatched instead of a hard `window.location.href` redirect so the React
// app (and its in-memory AuthContext/WebSocket state) isn't torn down by a
// full page load. A listener inside the Router tree (AppContent in App.js)
// performs the actual SPA navigation via useNavigate().
export const SESSION_EXPIRED_EVENT = 'auth:session-expired';

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
      const hadToken = Boolean(localStorage.getItem("auth_token"));
      // Don't redirect for auth endpoints — their 401 is an expected failure (wrong credentials).
      // Don't redirect for calls explicitly opted out (background/boot-time widgets whose 401
      // should degrade the widget, not the session).
      // Don't redirect while AuthContext's own GET /user hasn't resolved yet — that call always
      // starts with no user in state, so an unrelated 401 elsewhere during hydration must not
      // be treated as "session lost".
      // Don't redirect if there was never a token to begin with — nothing to expire.
      if (
        !error.config?.skipAuthRedirect &&
        !url.includes('/auth/login') &&
        !url.includes('/auth/register') &&
        !isAuthHydrating() &&
        hadToken
      ) {
        localStorage.removeItem("auth_token");
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
