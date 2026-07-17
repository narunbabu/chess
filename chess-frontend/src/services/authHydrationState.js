// src/services/authHydrationState.js
//
// Tiny module-level flag shared between AuthContext (a React context) and
// api.js (a plain axios module outside the React tree). AuthContext updates
// this flag as its `loading` state changes; api.js's response interceptor
// reads it to avoid redirecting to /login while the very first GET /user
// call on page load hasn't resolved yet (that call always starts with a
// null `user`, so any accidental 401 handling must not fire prematurely).
//
// Deliberately a separate module (not exported from AuthContext.js) so
// api.js can import it without creating a circular dependency with
// AuthContext.js, which itself imports api.js.

let isHydrating = true;

export const setAuthHydrating = (value) => {
  isHydrating = value;
};

export const isAuthHydrating = () => isHydrating;
