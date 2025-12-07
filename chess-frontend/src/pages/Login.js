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
  const [showManualAuth, setShowManualAuth] = useState(false);
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
      console.log('[Login] User is already authenticated, redirecting to lobby');
      navigate('/lobby');
    }
  }, [loading, isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (isLogin) {
        // Login flow
        const response = await api.post('/auth/login', {
          email,
          password
        });

        if (response.data.status === 'success') {
          await login(response.data.token);
          navigate("/lobby");
        }
      } else {
        // Register flow
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          setIsLoading(false);
          return;
        }

        const response = await api.post('/auth/register', {
          name,
          email,
          password,
          password_confirmation: confirmPassword
        });

        if (response.data.status === 'success') {
          await login(response.data.token);
          // Show skill assessment modal for new registrations
          setShowSkillAssessment(true);
          setIsLoading(false);
          return; // Don't navigate yet, wait for modal completion
        }
      }
    } catch (error) {
      console.error('Authentication error:', error);
      if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else {
        setError(isLogin ? 'Login failed. Please try again.' : 'Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkillAssessmentComplete = (rating) => {
    console.log('Skill assessment completed with rating:', rating);
    setShowSkillAssessment(false);
    navigate("/lobby");
  };

  const handleSkillAssessmentSkip = () => {
    console.log('Skill assessment skipped, using default 1200');
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

      <div className="min-h-screen flex flex-col items-center justify-start md:justify-center p-6 py-12 overflow-y-auto relative">
      <div
        className="absolute inset-0 z-0 opacity-10"
        style={{
          backgroundImage: 'radial-gradient(#4a5568 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      ></div>
      <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-gradient-to-br from-primary-600 via-transparent to-transparent opacity-20 blur-3xl"></div>
      <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-gradient-to-tl from-accent via-transparent to-transparent opacity-20 blur-3xl"></div>

      <div className="text-center z-10">
        {/* Educational Resource Message */}
        {requestedResource && (
          <div className="mb-6 p-4 bg-blue-600/90 backdrop-blur-sm rounded-xl border border-blue-400/30 max-w-2xl mx-auto">
            <div className="flex items-center justify-center mb-2">
              <svg className="w-6 h-6 mr-2 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-bold text-white">
                {requestedResource === 'tutorial' ? 'Access Free Chess Tutorials' : 'Join Exciting Tournaments'}
              </h2>
            </div>
            <p className="text-gray-100 text-sm">
              Please Login or Register to access our free {requestedResource === 'tutorial' ? 'chess lessons and interactive tutorials' : 'tournaments and competitive events'}.
            </p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center px-4 py-2 bg-gray-700/80 hover:bg-gray-600/80 text-white rounded-lg transition-colors duration-200"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Home
          </button>
          <button
            onClick={() => navigate('/play')}
            className="flex items-center px-4 py-2 bg-orange-600/80 hover:bg-orange-500/80 text-white rounded-lg transition-colors duration-200"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Play Computer
          </button>
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold mb-4 animate-[cardSlideIn_0.8s_ease-out] text-white">
          Master Chess at Your Own Pace
        </h1>
        <p className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto mb-8 animate-[cardSlideIn_0.9s_ease-out]">
          {requestedResource
            ? `Join Chess99 to access ${requestedResource === 'tutorial' ? 'free chess lessons and tutorials' : 'exciting tournaments and competitions'}`
            : "Improve your chess skills through practice, puzzles, and guided learning - no registration required to start playing."
          }
        </p>
      </div>

      {/* The login form will be placed in a card-like structure below this header */}
      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6 sm:p-8 z-10 mt-10">
        {error && <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white p-3 rounded-lg mb-4 text-center text-sm font-medium animate-[errorShake_0.5s_ease-out]">{error}</div>}

        {!showManualAuth ? (
          /* Google Sign-in Primary View */
          <div className="space-y-6">
            {/* Google Sign-in Button - Primary */}
            <a
              href={`${BASE_URL}/auth/google/redirect`}
              className="w-full flex items-center justify-center px-4 py-4 border-2 border-white/20 rounded-xl shadow-lg text-base font-semibold text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transform hover:scale-[1.02] transition-all duration-300 hover:shadow-red-500/50"
            >
              <svg className="w-6 h-6 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48px" height="48px">
                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C42.012,35.84,44,30.138,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
              </svg>
              Continue with Google
            </a>

            {/* Manual Login Link */}
            <div className="text-center">
              <button
                onClick={() => setShowManualAuth(true)}
                className="text-gray-400 hover:text-gray-200 text-sm underline transition-colors duration-200"
              >
                Manual Login/Signup
              </button>
            </div>

            {/* Terms and Privacy */}
            <div className="text-center mt-6">
              <p className="text-xs text-gray-400">
                By continuing, you agree to our <a href="/#" className="text-primary-500 hover:underline">Terms of Service</a> and <a href="/#" className="text-primary-500 hover:underline">Privacy Policy</a>.
              </p>
            </div>
          </div>
        ) : (
          /* Manual Authentication View */
          <div className="space-y-4">
            {/* Navigation Buttons Row */}
            <div className="flex flex-wrap gap-2 mb-4">
              {/* Back to Google Sign-in Button */}
              <button
                onClick={() => {
                  setShowManualAuth(false);
                  setError("");
                }}
                className="flex items-center px-3 py-2 bg-gray-700/80 hover:bg-gray-600/80 text-gray-300 text-sm rounded-lg transition-colors duration-200"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Sign-In Options
              </button>

              {/* Home Button */}
              <button
                onClick={() => navigate('/')}
                className="flex items-center px-3 py-2 bg-gray-700/80 hover:bg-gray-600/80 text-gray-300 text-sm rounded-lg transition-colors duration-200"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Home
              </button>

              {/* Play Computer Button */}
              <button
                onClick={() => navigate('/play')}
                className="flex items-center px-3 py-2 bg-orange-600/80 hover:bg-orange-500/80 text-white text-sm rounded-lg transition-colors duration-200"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Play Computer
              </button>
            </div>

            {/* Login/Register Toggle */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-2.5 px-4 rounded-lg font-semibold transition-all duration-300 ${
                  isLogin
                    ? 'bg-accent text-white shadow-lg'
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-2.5 px-4 rounded-lg font-semibold transition-all duration-300 ${
                  !isLogin
                    ? 'bg-accent text-white shadow-lg'
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Register
              </button>
            </div>

            {/* Manual Auth Form */}
            <form onSubmit={handleSubmit}>
              {!isLogin && (
                <div className="relative mb-4">
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={isLoading}
                    className="w-full px-4 py-3 bg-gray-700/50 border-2 border-gray-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition-all duration-300 text-white placeholder-gray-400"
                  />
                </div>
              )}

              <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                  <MailIcon />
                </div>
                <input
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-3 bg-gray-700/50 border-2 border-gray-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition-all duration-300 text-white placeholder-gray-400"
                />
              </div>

              <div className={`relative ${isLogin ? 'mb-6' : 'mb-4'}`}>
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                  <LockIcon />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="w-full pl-10 pr-12 py-3 bg-gray-700/50 border-2 border-gray-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition-all duration-300 text-white placeholder-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-200"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>

              {!isLogin && (
                <div className="relative mb-6">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                    <LockIcon />
                  </div>
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="w-full pl-10 pr-4 py-3 bg-gray-700/50 border-2 border-gray-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition-all duration-300 text-white placeholder-gray-400"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-accent text-white font-bold py-3 rounded-lg hover:scale-[1.02] hover:bg-accent-600 active:scale-100 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-primary-500/50 relative overflow-hidden group"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-white/50 border-t-white rounded-full animate-spin mx-auto"></div>
                ) : (
                  <>
                    <span className="relative z-10">{isLogin ? 'Login' : 'Register'}</span>
                    <div className="absolute top-0 left-[-100%] w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-all duration-500 group-hover:left-[100%] motion-reduce:hidden"></div>
                  </>
                )}
              </button>
            </form>

            {/* Terms and Privacy for Manual Auth */}
            <div className="text-center mt-6">
              <p className="text-xs text-gray-400">
                By continuing, you agree to our <a href="/#" className="text-primary-500 hover:underline">Terms of Service</a> and <a href="/#" className="text-primary-500 hover:underline">Privacy Policy</a>.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default LoginPage;
