import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import MailIcon from '../assets/icons/MailIcon';
import logo from '../assets/images/logo.png';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | oauth
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setError('');

    try {
      const response = await api.post('/auth/forgot-password', { email });
      if (response.data.oauth) {
        setStatus('oauth');
      } else {
        setStatus('success');
      }
    } catch (err) {
      // Even on server error show generic success — never leak user existence
      if (err.response?.status === 422) {
        setError(err.response.data?.message || 'Please enter a valid email address.');
        setStatus('idle');
      } else {
        setStatus('success');
      }
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-[#1a1a18] flex flex-col items-center justify-center px-4 py-8 relative"
      style={{ position: 'fixed', inset: 0, zIndex: 20 }}
    >
      {/* Back link */}
      <button
        onClick={() => navigate('/login')}
        className="absolute top-5 left-5 flex items-center text-[#8b8987] hover:text-white text-sm bg-transparent border-none p-0 transition-colors"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Sign In
      </button>

      <div className="w-full max-w-md sm:max-w-lg">
        {/* Logo + heading */}
        <div className="text-center mb-8">
          <img src={logo} alt="Chess99" className="h-12 mx-auto mb-5" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Forgot your password?</h1>
          <p className="text-[#8b8987] mt-2 text-sm sm:text-base">
            Enter your email and we'll send you a reset link
          </p>
        </div>

        <div className="bg-[#262421] rounded-xl border border-[#3d3a37] p-6 sm:p-8 shadow-xl">
          {/* OAuth message */}
          {status === 'oauth' && (
            <div className="text-center py-4">
              <div className="text-4xl mb-4">🔑</div>
              <h2 className="text-xl font-bold text-white mb-2">Use Google Sign In</h2>
              <p className="text-[#bababa] text-sm mb-5">
                This account was created with Google. Please sign in with Google — no password needed.
              </p>
              <Link
                to="/login"
                className="inline-block bg-[#81b64c] text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-[#93c85a] transition-colors text-sm"
              >
                Back to Sign In
              </Link>
            </div>
          )}

          {/* Success message */}
          {status === 'success' && (
            <div className="text-center py-4">
              <svg className="w-16 h-16 mx-auto text-[#81b64c] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
              <p className="text-[#bababa] text-sm mb-1">
                If <strong className="text-white">{email}</strong> is registered, we've sent a reset link.
              </p>
              <p className="text-[#8b8987] text-xs mt-3 mb-5">
                The link expires in 1 hour. Check your spam folder if you don't see it.
              </p>
              <Link
                to="/login"
                className="text-[#81b64c] hover:text-[#a3d160] text-sm bg-transparent border-none p-0 transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          )}

          {/* Form */}
          {(status === 'idle' || status === 'loading') && (
            <>
              {error && (
                <div className="bg-[#e74c3c] text-white p-3 rounded-lg mb-5 text-center text-sm font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#6b6966]">
                    <MailIcon />
                  </div>
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={status === 'loading'}
                    className="w-full pl-10 pr-4 py-3 bg-[#1a1a18] border border-[#3d3a37] rounded-lg text-sm text-white placeholder-[#6b6966] focus:border-[#81b64c] focus:outline-none transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full bg-[#81b64c] text-white font-semibold py-3 rounded-lg hover:bg-[#93c85a] active:bg-[#6fa03e] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {status === 'loading' ? (
                    <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin mx-auto" />
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </form>

              <p className="text-center text-sm text-[#8b8987] mt-5">
                Remember your password?{' '}
                <Link to="/login" className="text-[#81b64c] hover:text-[#a3d160] font-medium transition-colors">
                  Sign In
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
