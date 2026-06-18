
import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const AuthCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    // SECURITY (M1): the OAuth token now arrives in the URL fragment (#token=…)
    // so it never reaches server logs or the Referer header. Fall back to the
    // query string for backward compatibility during the deploy window.
    const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(location.search);
    const token = hashParams.get("token") || query.get("token");
    if (token) {
      // Strip the token from the address bar / history immediately.
      if (window.history.replaceState) {
        window.history.replaceState(null, "", window.location.pathname);
      }
      // Use the login function from AuthContext to properly set up authentication
      login(token).then((userData) => {
        // Check for pending redirect (e.g. user was on /pricing before login)
        const pendingRedirect = localStorage.getItem('pending_login_redirect');
        if (pendingRedirect) {
          localStorage.removeItem('pending_login_redirect');
        }

        // Redirect new users to profile setup, preserving where they wanted to go
        if (userData && userData.profile_completed === false) {
          const setupUrl = pendingRedirect
            ? `/profile?setup=true&redirect=${encodeURIComponent(pendingRedirect)}`
            : "/profile?setup=true";
          navigate(setupUrl);
        } else {
          navigate(pendingRedirect || "/lobby");
        }
      }).catch((error) => {
        console.error("Login failed:", error);
        navigate("/login");
      });
    } else {
      // Optionally handle the error (e.g., redirect to login with an error message)
      navigate("/login");
    }
  }, [location, navigate, login]);

  return (
    <div className="p-6 min-h-screen text-white flex items-center justify-center">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-8 text-center">
        <h2 className="text-2xl font-bold mb-4 text-vivid-yellow">Processing Authentication...</h2>
        <p className="text-gray-300">Please wait while we securely log you in.</p>
      </div>
    </div>
  );
};

export default AuthCallback;
