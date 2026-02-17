import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BASE_URL } from '../config';
import api from '../services/api';
import ReCAPTCHA from 'react-google-recaptcha';
import MailIcon from "../assets/icons/MailIcon";
import LockIcon from "../assets/icons/LockIcon";
import EyeIcon from "../assets/icons/EyeIcon";
import EyeOffIcon from "../assets/icons/EyeOffIcon";
import SkillAssessmentModal from '../components/auth/SkillAssessmentModal';
import logo from '../assets/images/logo.png';

const RECAPTCHA_SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY;

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
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [requestedResource, setRequestedResource] = useState(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [captchaToken, setCaptchaToken] = useState(null);
  const recaptchaRef = useRef(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated, loading } = useAuth();

  // Handle URL parameters for educational resources and email verification
  useEffect(() => {
    const resource = searchParams.get('resource');
    if (resource) {
      setRequestedResource(resource);
    }
    const verified = searchParams.get('verified');
    if (verified === '1') {
      setError('');
      setResendMessage('Email verified successfully! You can now sign in.');
    } else if (verified === 'invalid') {
      setError('Invalid verification link. Please request a new one.');
    }
  }, [searchParams]);

  // Auto-redirect authenticated users to lobby
  React.useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/lobby');
    }
  }, [loading, isAuthenticated, navigate]);

  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendMessage('');
    try {
      const response = await api.post('/auth/email/resend', { email: registeredEmail || email });
      setResendMessage(response.data.message || 'Verification email sent!');
    } catch (err) {
      setResendMessage('Failed to resend. Please try again later.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setResendMessage('');

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
        if (!captchaToken) {
          setError("Please complete the CAPTCHA.");
          setIsLoading(false);
          return;
        }
        const response = await api.post('/auth/register', {
          name, email, password, password_confirmation: confirmPassword,
          captcha_token: captchaToken,
        });
        if (response.data.requires_verification) {
          setRegistrationSuccess(true);
          setRegisteredEmail(email);
          setIsLoading(false);
          return;
        }
        if (response.data.status === 'success' && response.data.token) {
          await login(response.data.token);
          setShowSkillAssessment(true);
          setIsLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error('Authentication error:', err);
      const errorData = err.response?.data;
      if (errorData?.code === 'email_not_verified') {
        setRegisteredEmail(email);
        setError(errorData.message);
      } else {
        setError(
          errorData?.message ||
          (isLogin ? 'Login failed. Please try again.' : 'Registration failed. Please try again.')
        );
      }
      // Reset captcha on error
      if (recaptchaRef.current) {
        recaptchaRef.current.reset();
        setCaptchaToken(null);
      }
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

      <div className="min-h-screen w-full bg-[#1a1a18] flex flex-col items-center justify-center px-4 py-8 relative" style={{ position: 'fixed', inset: 0, zIndex: 20 }}>
        {/* Back link — top-left */}
        <button
          onClick={() => navigate('/')}
          className="absolute top-5 left-5 flex items-center text-[#8b8987] hover:text-white text-sm bg-transparent border-none p-0 transition-colors"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Card — proper desktop width, centered */}
        <div className="w-full max-w-md sm:max-w-lg">
          {/* Logo + heading */}
          <div className="text-center mb-8">
            <img src={logo} alt="Chess99" className="h-12 mx-auto mb-5" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              {showEmailForm
                ? (isLogin ? 'Sign in with email' : 'Create your account')
                : 'Welcome to Chess99'}
            </h1>
            {!showEmailForm && (
              <p className="text-[#8b8987] mt-2 text-sm sm:text-base">
                Sign in to play online, track progress, and compete
              </p>
            )}
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
          <div className="bg-[#262421] rounded-xl border border-[#3d3a37] p-6 sm:p-8 shadow-xl">
            {/* Error */}
            {error && (
              <div className="bg-[#e74c3c] text-white p-3 rounded-lg mb-5 text-center text-sm font-medium animate-[errorShake_0.5s_ease-out]">
                {error}
                {/* Show resend link when email not verified */}
                {registeredEmail && error.includes('verify') && (
                  <button
                    onClick={handleResendVerification}
                    disabled={resendLoading}
                    className="block mx-auto mt-2 text-white/80 hover:text-white underline text-xs bg-transparent border-none p-0"
                  >
                    {resendLoading ? 'Sending...' : 'Resend verification email'}
                  </button>
                )}
              </div>
            )}

            {/* Success messages (verification confirmed, resend success) */}
            {resendMessage && !error && (
              <div className="bg-[#81b64c] text-white p-3 rounded-lg mb-5 text-center text-sm font-medium">
                {resendMessage}
              </div>
            )}

            {/* Registration success — check email screen */}
            {registrationSuccess ? (
              <div className="text-center py-4">
                <div className="text-5xl mb-4">
                  <svg className="w-16 h-16 mx-auto text-[#81b64c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
                <p className="text-[#bababa] text-sm mb-1">
                  We sent a verification link to
                </p>
                <p className="text-white font-medium text-sm mb-4">{registeredEmail}</p>
                <p className="text-[#8b8987] text-xs mb-5">
                  Click the link in the email to activate your account, then come back to sign in.
                </p>
                <button
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                  className="text-[#81b64c] hover:text-[#a3d160] text-sm bg-transparent border-none p-0 transition-colors"
                >
                  {resendLoading ? 'Sending...' : "Didn't get it? Resend email"}
                </button>
                {resendMessage && (
                  <p className="text-[#81b64c] text-xs mt-2">{resendMessage}</p>
                )}
                <div className="mt-5 pt-4 border-t border-[#3d3a37]">
                  <button
                    onClick={() => { setRegistrationSuccess(false); setIsLogin(true); setError(''); setResendMessage(''); }}
                    className="text-[#8b8987] hover:text-white text-sm bg-transparent border-none p-0 transition-colors"
                  >
                    Back to Sign In
                  </button>
                </div>
              </div>
            ) : !showEmailForm ? (
              <div className="space-y-5">
                <a
                  href={`${BASE_URL}/auth/google/redirect`}
                  className="w-full flex items-center justify-center px-4 py-3.5 rounded-lg text-base font-semibold text-white bg-[#3d3a37] border border-[#4a4744] hover:bg-[#4a4744] transition-colors"
                >
                  <svg className="w-5 h-5 mr-3 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C42.012,35.84,44,30.138,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                  </svg>
                  Continue with Google
                </a>

                <button
                  onClick={() => setShowEmailForm(true)}
                  className="w-full text-center text-sm text-[#8b8987] hover:text-[#bababa] bg-transparent border-none p-0 transition-colors"
                >
                  Use email instead
                </button>
              </div>
            ) : (
              /* ── Email form view ── */
              <div>
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  {!isLogin && (
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      disabled={isLoading}
                      className="w-full px-4 py-3 bg-[#1a1a18] border border-[#3d3a37] rounded-lg text-sm text-white placeholder-[#6b6966] focus:border-[#81b64c] focus:outline-none transition-colors"
                    />
                  )}

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#6b6966]">
                      <MailIcon />
                    </div>
                    <input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className="w-full pl-10 pr-4 py-3 bg-[#1a1a18] border border-[#3d3a37] rounded-lg text-sm text-white placeholder-[#6b6966] focus:border-[#81b64c] focus:outline-none transition-colors"
                    />
                  </div>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#6b6966]">
                      <LockIcon />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="w-full pl-10 pr-11 py-3 bg-[#1a1a18] border border-[#3d3a37] rounded-lg text-sm text-white placeholder-[#6b6966] focus:border-[#81b64c] focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#6b6966] hover:text-[#bababa]"
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>

                  {!isLogin && (
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#6b6966]">
                        <LockIcon />
                      </div>
                      <input
                        type="password"
                        placeholder="Confirm Password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        className="w-full pl-10 pr-4 py-3 bg-[#1a1a18] border border-[#3d3a37] rounded-lg text-sm text-white placeholder-[#6b6966] focus:border-[#81b64c] focus:outline-none transition-colors"
                      />
                    </div>
                  )}

                  {/* reCAPTCHA — registration only */}
                  {!isLogin && RECAPTCHA_SITE_KEY && (
                    <div className="flex justify-center" style={{ transform: 'scale(0.9)', transformOrigin: 'center' }}>
                      <ReCAPTCHA
                        ref={recaptchaRef}
                        sitekey={RECAPTCHA_SITE_KEY}
                        theme="dark"
                        onChange={(token) => setCaptchaToken(token)}
                        onExpired={() => setCaptchaToken(null)}
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || (!isLogin && !captchaToken)}
                    className="w-full bg-[#81b64c] text-white font-semibold py-3 rounded-lg hover:bg-[#93c85a] active:bg-[#6fa03e] disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-1"
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
                    onClick={() => { setIsLogin(!isLogin); setError(""); setCaptchaToken(null); if (recaptchaRef.current) recaptchaRef.current.reset(); }}
                    className="text-[#81b64c] hover:text-[#a3d160] font-medium bg-transparent border-none p-0 transition-colors"
                  >
                    {isLogin ? 'Register' : 'Sign In'}
                  </button>
                </p>

                {/* Back to Google */}
                <button
                  onClick={() => { setShowEmailForm(false); setError(""); }}
                  className="w-full text-center text-sm text-[#6b6966] hover:text-[#8b8987] bg-transparent border-none p-0 transition-colors mt-3"
                >
                  Back to sign-in options
                </button>
              </div>
            )}
          </div>

          {/* Terms */}
          <p className="text-center text-xs text-[#6b6966] mt-6">
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
