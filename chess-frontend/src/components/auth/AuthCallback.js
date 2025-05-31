
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const AuthCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const processAuth = async () => {
      const query = new URLSearchParams(location.search);
      const token = query.get("token");
      const isNewUser = query.get("new_user");
      
      if (token) {
        try {
          await login(token);
          if (isNewUser) {
            navigate("/dashboard?welcome=1");
          } else {
            navigate("/dashboard");
          }
        } catch (error) {
          navigate("/login?error=auth_failed");
        }
      } else {
        navigate("/login?error=auth_failed");
      }
      setIsProcessing(false);
    };

    processAuth();
  }, [location, navigate, login]);

  if (isProcessing) {
    return (
      <div className="auth-callback">
        <div className="loading-spinner"></div>
        <p>Processing authentication...</p>
      </div>
    );
  }

  return null;
};

export default AuthCallback;
