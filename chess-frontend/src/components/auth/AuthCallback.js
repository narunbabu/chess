// src/components/auth/AuthCallback.js
import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const AuthCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const token = query.get("token");
    if (token) {
      localStorage.setItem("auth_token", token);
      navigate("/dashboard");
    } else {
      // Optionally handle the error (e.g., redirect to login with an error message)
      navigate("/login");
    }
  }, [location, navigate]);

  return <div>Processing authentication...</div>;
};

export default AuthCallback;
