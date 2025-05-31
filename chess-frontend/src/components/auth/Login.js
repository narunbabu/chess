
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import SocialLogin from "./SocialLogin";
import api from "../../services/api";
import "./Login.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
    }

    // Check for error in URL
    const query = new URLSearchParams(location.search);
    const errorParam = query.get("error");
    if (errorParam) {
      setError("Social login failed. Please try again.");
    }
  }, [isAuthenticated, navigate, location]);

  const getRefCode = () => {
    const query = new URLSearchParams(location.search);
    return query.get("ref");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (isRegistering) {
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }

      try {
        const payload = {
          name,
          email,
          password,
          password_confirmation: confirmPassword
        };

        const refCode = getRefCode();
        if (refCode) {
          payload.ref_code = refCode;
        }

        const response = await api.post("/auth/register", payload);
        await login(response.data.token);
        navigate("/dashboard");
      } catch (err) {
        setError(err.response?.data?.message || "Registration failed");
      }
    } else {
      try {
        const response = await api.post("/auth/login", { email, password });
        await login(response.data.token);
        navigate("/dashboard");
      } catch (err) {
        setError(err.response?.data?.message || "Login failed");
      }
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Welcome to Chess Trainer</h1>
          <p>Improve your chess skills with AI-powered training</p>
          {getRefCode() && (
            <div className="referral-bonus">
              🎁 Join with referral code and get 25 bonus credits!
            </div>
          )}
        </div>

        <div className="login-content">
          {error && <div className="error-message">{error}</div>}
          
          <form onSubmit={handleSubmit} className="auth-form">
            {isRegistering && (
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {isRegistering && (
              <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            )}
            <div className="auth-buttons">
              <button type="submit">
                {isRegistering ? "Register" : "Login"}
              </button>
              <button 
                type="button" 
                onClick={() => setIsRegistering(!isRegistering)}
                className="secondary-button"
              >
                {isRegistering ? "Already have an account?" : "Create Account"}
              </button>
            </div>
          </form>

          <div className="divider">OR</div>

          <SocialLogin refCode={getRefCode()} />
        </div>

        <div className="login-footer">
          <p>
            By continuing, you agree to our{" "}
            <a href="/terms">Terms of Service</a> and{" "}
            <a href="/privacy">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
