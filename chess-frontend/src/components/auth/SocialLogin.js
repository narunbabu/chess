// src/components/auth/SocialLogin.jsx
import React from "react";
import { BACKEND_URL } from "../../config";

const SocialLogin = () => {
  const handleSocialLogin = (provider) => {
    window.location.href = `${BACKEND_URL}/auth/${provider}/redirect`;
  };

  return (
    <div className="social-login">
      <h3>Or login with</h3>
      <div className="social-buttons">
        <button
          onClick={() => handleSocialLogin("google")}
          className="google-btn"
        >
          <i className="fab fa-google"></i> Google
        </button>
        <button
          onClick={() => handleSocialLogin("facebook")}
          className="facebook-btn"
        >
          <i className="fab fa-facebook"></i> Facebook
        </button>
      </div>
    </div>
  );
};

export default SocialLogin;
