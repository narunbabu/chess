import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BASE_URL } from '../config';
import api from '../services/api';
import MailIcon from "../assets/icons/MailIcon";
import LockIcon from "../assets/icons/LockIcon";
import EyeIcon from "../assets/icons/EyeIcon";
import EyeOffIcon from "../assets/icons/EyeOffIcon";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

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
          navigate("/lobby");
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 overflow-hidden relative">
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
        <h1 className="text-5xl md:text-7xl font-extrabold mb-4 animate-[cardSlideIn_0.8s_ease-out] text-white">
          Master Chess at Your Own Pace
        </h1>
        <p className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto mb-8 animate-[cardSlideIn_0.9s_ease-out]">
          Improve your chess skills through practice, puzzles, and guided learning - no registration required to start playing.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-[cardSlideIn_1.0s_ease-out]">
          <button onClick={() => setIsLogin(true)} className="bg-accent text-white font-bold py-3 px-8 rounded-full text-lg hover:scale-105 hover:bg-accent-600 transform transition-all duration-300 shadow-lg">
            Login
          </button>
          <button onClick={() => setIsLogin(false)} className="bg-gray-700 text-gray-200 font-bold py-3 px-8 rounded-full text-lg hover:bg-gray-600 transform transition-colors duration-300 shadow-lg">
            Register
          </button>
        </div>
      </div>

      {/* The login form will be placed in a card-like structure below this header */}
      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6 sm:p-8 z-10 mt-10">
        {/* This div will contain the form and related elements */}

        {error && <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white p-3 rounded-lg mb-4 text-center text-sm font-medium animate-[errorShake_0.5s_ease-out]">{error}</div>}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="relative mb-4">
              <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} required disabled={isLoading} className="w-full px-4 py-3 bg-gray-700/50 border-2 border-gray-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition-all duration-300 text-white placeholder-gray-400" />
            </div>
          )}

          <div className="relative mb-4">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
              <MailIcon />
            </div>
            <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} className="w-full pl-10 pr-4 py-3 bg-gray-700/50 border-2 border-gray-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition-all duration-300 text-white placeholder-gray-400" />
          </div>

          <div className={`relative ${isLogin ? 'mb-6' : 'mb-4'}`}>
            <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
              <LockIcon />
            </div>
            <input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} className="w-full pl-10 pr-12 py-3 bg-gray-700/50 border-2 border-gray-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition-all duration-300 text-white placeholder-gray-400" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-200">
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

          {!isLogin && (
            <div className="relative mb-6">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                <LockIcon />
              </div>
              <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={isLoading} className="w-full pl-10 pr-4 py-3 bg-gray-700/50 border-2 border-gray-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition-all duration-300 text-white placeholder-gray-400" />
            </div>
          )}

          <button type="submit" disabled={isLoading} className="w-full bg-accent text-white font-bold py-3 rounded-lg hover:scale-[1.02] hover:bg-accent-600 active:scale-100 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-primary-500/50 relative overflow-hidden group">
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

        <div className="relative flex items-center justify-center my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-800 text-gray-400">OR</span>
          </div>
        </div>

        <div>
          <a href={`${BASE_URL}/auth/google/redirect`} className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700">
            <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48px" height="48px"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C42.012,35.84,44,30.138,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg>
            Sign in with Google
          </a>
        </div>

        {/* Removed "OR" divider and social login placeholder */}
        
        <div className="text-center mt-8">
            <p className="text-xs text-gray-400">
                By continuing, you agree to our <a href="/#" className="text-primary-500 hover:underline">Terms of Service</a> and <a href="/#" className="text-primary-500 hover:underline">Privacy Policy</a>.
            </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
