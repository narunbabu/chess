// src/components/auth/SocialLogin.jsx
import React from "react";
import { BACKEND_URL } from "../../config";

const SocialLogin = () => {
  const handleSocialLogin = (provider) => {
    window.location.href = `${BACKEND_URL}/auth/${provider}/redirect`;
  };

  return (
    <div className="social-login text-center mt-6">
      <h3 className="text-sm text-gray-400 mb-4">Or continue with</h3>
      <div className="social-buttons flex justify-center gap-4">
        <button
          onClick={() => handleSocialLogin("google")}
          className="social-button google-btn flex items-center justify-center gap-2 bg-ryb-orange hover:bg-vivid-yellow text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300"
        >
          <i className="fab fa-google"></i> Google
        </button>
        <button
          onClick={() => handleSocialLogin("facebook")}
          className="social-button facebook-btn flex items-center justify-center gap-2 bg-picton-blue hover:bg-blue-violet text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300"
        >
          <i className="fab fa-facebook"></i> Facebook
        </button>
      </div>
    </div>
  );
};

export default SocialLogin;
