import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BASE_URL } from '../config';
import api from '../services/api';
import MailIcon from "../assets/icons/MailIcon";
import LockIcon from "../assets/icons/LockIcon";
import EyeIcon from "../assets/icons/EyeIcon";
import EyeOffIcon from "../assets/icons/EyeOffIcon";
import SkillAssessmentModal from '../components/auth/SkillAssessmentModal';
import logo from '../assets/images/logo.png';

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSkillAssessment, setShowSkillAssessment] = useState(false);
  const [requestedResource, setRequestedResource] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated, loading } = useAuth();

  // Handle URL parameters for educational resources
  useEffect(() => {
    const resource = searchParams.get('resource');
    if (resource) {
      setRequestedResource(resource);
    }
  }, [searchParams]);

  // Auto-redirect authenticated users to lobby
  React.useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/lobby');
    }
  }, [loading, isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (isLogin) {
        const response = await api.post('/auth/login', { email, password });
        if (response.data.status === 'success') {
          await login(response.data.token);
          navigate("/lobby");
        }
      } else {
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          setIsLoading(false);
          return;
        }
        const response = await api.post('/auth/register', {
          name, email, password, password_confirmation: confirmPassword
        });
        if (response.data.status === 'success') {
          await login(response.data.token);
          setShowSkillAssessment(true);
          setIsLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setError(
        err.response?.data?.message ||
        (isLogin ? 'Login failed. Please try again.' : 'Registration failed. Please try again.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkillAssessmentComplete = (rating) => {
    setShowSkillAssessment(false);
    navigate("/lobby");
  };

  const handleSkillAssessmentSkip = () => {
    setShowSkillAssessment(false);
    navigate("/lobby");
  };

  return (
    <>
      <SkillAssessmentModal
        isOpen={showSkillAssessment}
        onComplete={handleSkillAssessmentComplete}
        onSkip={handleSkillAssessmentSkip}
      />

      <div className="min-h-screen bg-[#1a1a18] flex flex-col items-center justify-center px-4 py-8 relative">
        {/* Back link — top-left */}
        <button
          onClick={() => navigate('/')}
          className="absolute top-5 left-5 flex items-center text-[#8b8987] hover:text-white text-sm transition-colors"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Card */}
        <div className="w-full max-w-sm">
          {/* Logo + heading */}
          <div className="text-center mb-8">
            <img src={logo} alt="Chess99" className="h-10 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-white">
              {isLogin ? 'Sign in to continue' : 'Create your account'}
            </h1>
          </div>

          {/* Resource banner */}
          {requestedResource && (
            <div className="mb-6 px-4 py-3 bg-[#262421] rounded-lg border border-[#81b64c]/30 text-center">
              <p className="text-sm text-[#bababa]">
                {requestedResource === 'tutorial'
                  ? 'Sign in to access free chess lessons'
                  : 'Sign in to join tournaments'}
              </p>
            </div>
          )}

          {/* Auth card */}
          <div className="bg-[#262421] rounded-xl border border-[#3d3a37] p-6 shadow-xl">
            {/* Error */}
            {error && (
              <div className="bg-[#e74c3c] text-white p-3 rounded-lg mb-4 text-center text-sm font-medium animate-[errorShake_0.5s_ease-out]">
                {error}
              </div>
            )}

            {/* Google Sign-in */}
            <a
              href={`${BASE_URL}/auth/google/redirect`}
              className="w-full flex items-center justify-center px-4 py-3 rounded-lg text-sm font-semibold text-white bg-[#3d3a37] border border-[#4a4744] hover:bg-[#4a4744] transition-colors"
            >
              <svg className="w-5 h-5 mr-2.5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C42.012,35.84,44,30.138,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
              </svg>
              Continue with Google
            </a>

            {/* Divider */}
            <div className="flex items-center my-5">
              <div className="flex-1 h-px bg-[#3d3a37]" />
              <span className="px-3 text-xs text-[#8b8987]">or</span>
              <div className="flex-1 h-px bg-[#3d3a37]" />
            </div>

            {/* Email form — always visible */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {!isLogin && (
                <input
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 bg-[#1a1a18] border border-[#3d3a37] rounded-lg text-sm text-white placeholder-[#6b6966] focus:border-[#81b64c] focus:outline-none transition-colors"
                />
              )}

              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[#6b6966]">
                  <MailIcon />
                </div>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-[#1a1a18] border border-[#3d3a37] rounded-lg text-sm text-white placeholder-[#6b6966] focus:border-[#81b64c] focus:outline-none transition-colors"
                />
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[#6b6966]">
                  <LockIcon />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="w-full pl-9 pr-10 py-2.5 bg-[#1a1a18] border border-[#3d3a37] rounded-lg text-sm text-white placeholder-[#6b6966] focus:border-[#81b64c] focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#6b6966] hover:text-[#bababa]"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>

              {!isLogin && (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[#6b6966]">
                    <LockIcon />
                  </div>
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-[#1a1a18] border border-[#3d3a37] rounded-lg text-sm text-white placeholder-[#6b6966] focus:border-[#81b64c] focus:outline-none transition-colors"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#81b64c] text-white font-semibold py-2.5 rounded-lg hover:bg-[#93c85a] active:bg-[#6fa03e] disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-1"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin mx-auto" />
                ) : (
                  isLogin ? 'Sign In' : 'Create Account'
                )}
              </button>
            </form>

            {/* Toggle login/register */}
            <p className="text-center text-sm text-[#8b8987] mt-5">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => { setIsLogin(!isLogin); setError(""); }}
                className="text-[#81b64c] hover:text-[#a3d160] font-medium transition-colors"
              >
                {isLogin ? 'Register' : 'Sign In'}
              </button>
            </p>
          </div>

          {/* Terms */}
          <p className="text-center text-xs text-[#6b6966] mt-5">
            By continuing, you agree to our{' '}
            <a href="/terms-of-service.html" target="_blank" rel="noopener noreferrer" className="text-[#8b8987] hover:text-white transition-colors">Terms</a>
            {' '}and{' '}
            <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer" className="text-[#8b8987] hover:text-white transition-colors">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
