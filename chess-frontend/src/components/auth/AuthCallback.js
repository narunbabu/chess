
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
