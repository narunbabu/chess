import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';
import LockIcon from '../assets/icons/LockIcon';
import EyeIcon from '../assets/icons/EyeIcon';
import EyeOffIcon from '../assets/icons/EyeOffIcon';
import logo from '../assets/images/logo.png';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMessage, setErrorMessage] = useState('');

  // Validate params on mount
  useEffect(() => {
    if (!token || !email) {
      setStatus('error');
      setErrorMessage('Invalid reset link. Please request a new one.');
    }
  }, [token, email]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== passwordConfirmation) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    setStatus('loading');
    setErrorMessage('');

    try {
      await api.post('/auth/reset-password', {
        token,
        email,
        password,
        password_confirmation: passwordConfirmation,
      });
      setStatus('success');
      // Redirect to login after 2 seconds
      setTimeout(() => navigate('/login?reset=success'), 2000);
    } catch (err) {
      setStatus('idle');
      setErrorMessage(
        err.response?.data?.message || 'Something went wrong. Please try again.'
      );
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
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Set a new password</h1>
          <p className="text-[#8b8987] mt-2 text-sm sm:text-base">
            Choose a strong password for your account
          </p>
        </div>

        <div className="bg-[#262421] rounded-xl border border-[#3d3a37] p-6 sm:p-8 shadow-xl">
          {/* Success */}
          {status === 'success' && (
            <div className="text-center py-4">
              <svg className="w-16 h-16 mx-auto text-[#81b64c] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-bold text-white mb-2">Password updated!</h2>
              <p className="text-[#bababa] text-sm">
                Redirecting you to sign in…
              </p>
            </div>
          )}

          {/* Invalid link error */}
          {status === 'error' && (
            <div className="text-center py-4">
              <div className="text-4xl mb-4">🔗</div>
              <h2 className="text-xl font-bold text-white mb-2">Invalid reset link</h2>
              <p className="text-[#bababa] text-sm mb-5">{errorMessage}</p>
              <Link
                to="/forgot-password"
                className="inline-block bg-[#81b64c] text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-[#93c85a] transition-colors text-sm"
              >
                Request a new link
              </Link>
            </div>
          )}

          {/* Form */}
          {(status === 'idle' || status === 'loading') && (
            <>
              {errorMessage && (
                <div className="bg-[#e74c3c] text-white p-3 rounded-lg mb-5 text-center text-sm font-medium">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New password */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#6b6966]">
                    <LockIcon />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="New password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    disabled={status === 'loading'}
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

                {/* Confirm password */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#6b6966]">
                    <LockIcon />
                  </div>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    value={passwordConfirmation}
                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                    required
                    disabled={status === 'loading'}
                    className="w-full pl-10 pr-11 py-3 bg-[#1a1a18] border border-[#3d3a37] rounded-lg text-sm text-white placeholder-[#6b6966] focus:border-[#81b64c] focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#6b6966] hover:text-[#bababa]"
                  >
                    {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>

                <p className="text-xs text-[#6b6966]">Minimum 8 characters</p>

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full bg-[#81b64c] text-white font-semibold py-3 rounded-lg hover:bg-[#93c85a] active:bg-[#6fa03e] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {status === 'loading' ? (
                    <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin mx-auto" />
                  ) : (
                    'Update Password'
                  )}
                </button>
              </form>

              <p className="text-center text-sm text-[#8b8987] mt-5">
                Need a new link?{' '}
                <Link to="/forgot-password" className="text-[#81b64c] hover:text-[#a3d160] font-medium transition-colors">
                  Request reset
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
