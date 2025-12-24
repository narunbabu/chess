import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { trackUI } from '../utils/analytics';
import AuthGateModal from '../components/layout/AuthGateModal';
import UnfinishedGamesSection from '../components/UnfinishedGamesSection';
import chessPlayingKids from '../assets/images/chess-playing-kids-crop.jpeg';
import logo from '../assets/images/logo.png';
import '../styles/UnifiedCards.css';

const LandingPage = () => {
  const { isAuthenticated, loading } = useAuth();
  const [loginType, setLoginType] = useState('guest');
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const navigate = useNavigate();

  // Auto-redirect authenticated users to lobby
  useEffect(() => {
    if (!loading && isAuthenticated) {
      console.log('[LandingPage] User is authenticated, redirecting to lobby');
      navigate('/lobby');
    }
  }, [loading, isAuthenticated, navigate]);

  // Smooth scroll behavior for mobile
  useEffect(() => {
    // Add smooth scrolling behavior
    document.documentElement.style.scrollBehavior = 'smooth';

    return () => {
      // Clean up
      document.documentElement.style.scrollBehavior = '';
    };
  }, []);

  const stats = [
    { number: '12M+', label: 'Happy Young Learners', icon: '😊', colorClass: 'bg-orange' },
    { number: '28,000+', label: 'Schools Inspired', icon: '🏫', colorClass: 'bg-blue' },
    { number: '91M+', label: 'Safe Games Played', icon: '♟️', colorClass: 'bg-green' },
    { number: '113M+', label: 'Puzzles Solved by Kids', icon: '🧩', colorClass: 'bg-purple' },
    { number: '16M+', label: 'Lessons Completed', icon: '📚', colorClass: 'bg-pink' }
  ];

  return (
    <>
    <div data-page="landing" className="bg-white w-full min-h-screen overflow-x-hidden flex flex-col">
      {/* Fixed Header - Dark Sky Blue */}
      <header className="fixed top-0 inset-x-0 z-30 h-16 bg-sky-600/95 text-white backdrop-blur-sm shadow">
        <div className="w-full h-full px-3 sm:px-4 lg:px-8 xl:px-12 flex items-center justify-between">
          {/* Left Section - Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <img src={logo} alt="Chess99 Logo" className="h-8 w-auto" />
            </Link>
          </div>

          {/* Desktop Navigation - Hidden on small screens */}
          <nav className="hidden md:flex items-center space-x-3 lg:space-x-6">
            {/* <button onClick={() => navigate('/play')} className="hover:text-yellow-300 transition-colors text-sm lg:text-base font-medium">Play</button> */}
            <button onClick={() => navigate('/login?resource=tutorial')} className="hover:text-yellow-300 transition-colors text-sm lg:text-base font-medium">Tutorial</button>
            <button onClick={() => navigate('/login?resource=tournaments')} className="hover:text-yellow-300 transition-colors text-sm lg:text-base font-medium">Tournaments</button>
          </nav>

          {/* Right Section - Auth Buttons & Menu */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Play Button - Always visible */}
            <button
              onClick={() => navigate('/play')}
              className="hidden sm:block bg-orange-500 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors shadow"
            >
              Play
            </button>

            {/* Auth Buttons - Desktop */}
            {!isAuthenticated && (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="hidden sm:block hover:text-yellow-300 transition-colors text-sm lg:text-base font-medium"
                >
                  Login
                </button>
                <button
                  onClick={() => navigate('/signup')}
                  className="hidden sm:block bg-yellow-400 text-gray-800 px-3 lg:px-4 py-1.5 sm:py-2 rounded-lg text-sm lg:text-base font-semibold hover:bg-yellow-500 transition-colors shadow"
                >
                  Sign Up
                </button>
              </>
            )}

            {/* Mobile: Play, Login, Sign Up, and Menu Button */}
            <div className="flex items-center space-x-2 sm:hidden">
              <button
                onClick={() => navigate('/play')}
                className="bg-orange-500 text-white px-2 py-1.5 rounded-lg text-xs font-semibold hover:bg-orange-600 transition-colors shadow"
              >
                Play
              </button>
              {!isAuthenticated && (
                <>
                  <button
                    onClick={() => navigate('/login')}
                    className="text-white px-2 py-1.5 rounded-lg text-xs font-semibold hover:bg-sky-700/50 transition-colors"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => navigate('/signup')}
                    className="bg-yellow-400 text-gray-800 px-2 py-1.5 rounded-lg text-xs font-semibold hover:bg-yellow-500 transition-colors shadow"
                  >
                    Sign Up
                  </button>
                </>
              )}
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="p-2 rounded-lg hover:bg-sky-700/50 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {showMobileMenu && (
          <div className="absolute top-16 left-0 right-0 bg-sky-600/98 backdrop-blur-sm shadow-lg sm:hidden">
            <nav className="flex flex-col p-4 space-y-2">
              {/* <button
                onClick={() => { navigate('/play'); setShowMobileMenu(false); }}
                className="text-left px-4 py-3 hover:bg-sky-700/50 rounded-lg transition-colors text-sm font-medium"
              >
                Play
              </button> */}
              <button
                onClick={() => { navigate('/login?resource=tutorial'); setShowMobileMenu(false); }}
                className="text-left px-4 py-3 hover:bg-sky-700/50 rounded-lg transition-colors text-sm font-medium"
              >
                Tutorial
              </button>
              <button
                onClick={() => { navigate('/login?resource=tournaments'); setShowMobileMenu(false); }}
                className="text-left px-4 py-3 hover:bg-sky-700/50 rounded-lg transition-colors text-sm font-medium"
              >
                Tournaments
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content - Full Height Below Header */}
      <main className="flex-grow pt-16">
        {/* Hero Section - Top Portion Only */}
      <section className="hero-section relative overflow-hidden bg-gradient-to-b from-sky-400 via-sky-300 to-sky-200 w-full z-10">
        {/* Decorative clouds */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-20 left-10 w-24 h-12 bg-white rounded-full opacity-70"></div>
          <div className="absolute top-32 right-20 w-32 h-16 bg-white rounded-full opacity-60"></div>
          <div className="absolute top-48 left-1/3 w-20 h-10 bg-white rounded-full opacity-50"></div>
          <div className="absolute top-24 right-1/3 w-28 h-14 bg-white rounded-full opacity-65"></div>
        </div>

        {/* Hero Content - Single container with background and content */}
        <div className="relative w-full hero-content-container" style={{zIndex: '1'}}>
          {/* Content overlay with background image */}
          <div className="relative z-20 flex flex-col items-center justify-start px-3 sm:px-4 lg:px-8 xl:px-12">
            {/* Background image - positioned behind content */}
            <img
              src={chessPlayingKids}
              alt="Kids playing chess"
              className="hero-bg-image -z-10"
            />
            <div className="hero-soft-glow" />
            <div className="absolute inset-0 bg-gradient-to-b from-sky-400/10 via-sky-300/5 to-sky-200/10 -z-10"></div>
            {/* Headline with dark backdrop */}
            <div className="text-center text-white mb-4 sm:mb-6 lg:mb-8 w-full max-w-4xl mx-auto mt-2 sm:mt-4">
               <div className="inline-block rounded-2xl bg-black/30 backdrop-blur-sm px-4 sm:px-6 py-3 sm:py-4 mx-2 sm:mx-0">
                 <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-2 sm:mb-3 lg:mb-4 px-2 sm:px-4">
                   India's #1 Online Chess Academy for Kids
                 </h1>
                 <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl opacity-95 px-2 sm:px-4">Trusted by Parents & Schools. Safe, Educational, and Designed for Ages 5-16.</p>
               </div>
            </div>

            {/* Quick Login Options - Mobile Optimized */}
            {/* {!isAuthenticated && (
              <div className="text-center mb-6 sm:mb-8">
                <div className="inline-flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-6 bg-white/90 backdrop-blur-sm rounded-xl px-6 sm:px-8 py-4 shadow-xl border border-white/20 max-w-sm mx-auto">
                  <label className="flex items-center cursor-pointer w-full sm:w-auto justify-center">
                    <input
                      type="radio"
                      name="loginType"
                      value="guest"
                      className="mr-2 sm:mr-3 text-orange-500 w-4 h-4"
                      checked={loginType === 'guest'}
                      onChange={() => setLoginType('guest')}
                    />
                    <span className="text-gray-800 font-semibold text-sm sm:text-base">Guest</span>
                  </label>
                  <span className="text-gray-400 text-xl hidden sm:inline-block">|</span>
                  <div className="w-px h-px bg-gray-400 sm:hidden"></div>
                  <label className="flex items-center cursor-pointer w-full sm:w-auto justify-center">
                    <input
                      type="radio"
                      name="loginType"
                      value="login"
                      className="mr-2 sm:mr-3 text-orange-500 w-4 h-4"
                      checked={loginType === 'login'}
                      onChange={() => setLoginType('login')}
                    />
                    <span className="text-gray-800 font-semibold text-sm sm:text-base">Own Account</span>
                  </label>
                </div>
              </div>
            )} */}

            {/* Action Buttons - Mobile Optimized */}
            <div className="flex flex-col items-center justify-center w-full px-3 sm:px-4 max-w-lg mx-auto relative z-25">
              {isAuthenticated ? (
                <div className="unified-card w-full">
                  <h3 className="unified-card-title centered text-lg sm:text-xl lg:text-2xl">Choose Your Opponent</h3>
                  <div className="unified-card-actions vertical">
                    <button
                      onClick={() => {
                        trackUI('cta_button', 'click', { button: 'play_computer', location: 'landing_authenticated' });
                        navigate('/play');
                      }}
                      className="unified-card-btn primary text-sm sm:text-base"
                    >
                      <span className="mr-2">🤖</span>
                      Play with Computer (Free)
                    </button>
                    <button
                      onClick={() => {
                        trackUI('cta_button', 'click', { button: 'play_friends', location: 'landing_authenticated' });
                        navigate('/lobby');
                      }}
                      className="unified-card-btn secondary text-sm sm:text-base"
                    >
                      <span className="mr-2">👥</span>
                      Play with Friends (Safe Online Play)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="unified-card w-full max-w-sm sm:max-w-md mx-auto">
                  <h3 className="unified-card-title centered text-xl sm:text-2xl">Start Your Chess Journey!</h3>
                  <div className="unified-card-actions vertical">
                    <button
                      onClick={() => navigate('/play')}
                      className="unified-card-btn primary text-sm sm:text-base"
                    >
                      <span className="mr-2">🤖</span>
                      Play with Computer (Free)
                    </button>
                    <button
                      onClick={() => setShowAuthGate(true)}
                      className="unified-card-btn secondary text-sm sm:text-base"
                    >
                      <span className="mr-2">👥</span>
                      Play with Friends (Safe Online Play)
                    </button>
                    <button
                      onClick={() => navigate('/learn')}
                      className="unified-card-btn neutral text-sm sm:text-base"
                    >
                      <span className="mr-2">📚</span>
                      Start Learning (Beginner to Advanced)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Trust Badges Section - Attractive Cards */}
            <div className="mt-4 sm:mt-6 lg:mt-8 w-full max-w-5xl mx-auto relative z-20">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {/* Safety Card */}
                <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-lg border-2 border-green-100 hover:shadow-xl transition-all duration-300 h-auto">
                  <div className="flex items-center mb-2 sm:mb-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-full flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-green-800 leading-tight">100% Safe for Kids</h3>
                  </div>
                  <p className="text-gray-700 text-sm sm:text-base leading-relaxed">No Ads • No Chats • No Payments Needed to Start</p>
                </div>

                {/* Educational Platform Card */}
                <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-lg border-2 border-blue-100 hover:shadow-xl transition-all duration-300 h-auto">
                  <div className="flex items-center mb-2 sm:mb-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-blue-800 leading-tight">Educational Platform</h3>
                  </div>
                  <p className="text-gray-700 text-sm sm:text-base leading-relaxed">Skill-Based Learning • Not Gambling • No Real-Money Gaming</p>
                </div>

                {/* Trusted Card */}
                <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-lg border-2 border-purple-100 hover:shadow-xl transition-all duration-300 h-auto">
                  <div className="flex items-center mb-2 sm:mb-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-full flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-purple-800 leading-tight">Trusted by Neumerous people</h3>
                  </div>
                  <p className="text-gray-700 text-sm sm:text-base leading-relaxed">Numerous Young Learners • Schools • Parent Approved</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Game History Section - Only show for guest users - Moved outside Hero */}
      {!isAuthenticated && (
        <section className="relative bg-gradient-to-b from-sky-200 to-white py-8 sm:py-12 z-20">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 xl:px-12">
            <div className="w-full max-w-md mx-auto">
              <Link
                to="/game-history"
                onClick={() => trackUI('game_history', 'click', { button: 'view_games', location: 'landing_page' })}
                className="unified-card light-theme hover:shadow-xl transition-all duration-300 cursor-pointer block transform hover:scale-105"
              >
                <div className="unified-card-header">
                  <div className="unified-card-avatar">🔄</div>
                  <h3 className="unified-card-title centered text-xl sm:text-2xl">Your Chess Journey</h3>
                </div>
                <div className="unified-card-body text-center">
                  <p className="text-gray-700 mb-4 text-base sm:text-lg">
                    Practice games and track your progress
                  </p>
                  <div className="inline-flex items-center text-orange-500 font-bold text-base sm:text-lg">
                    <span>View Progress</span>
                    <span className="ml-2 text-xl">→</span>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Stats Section (Commented Out)
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 xl:px-12 py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-center mb-6 sm:mb-8 lg:mb-12" style={{color: 'var(--ink)'}}>
            Our Impact in Numbers
          </h2>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 lg:gap-8">
            {stats.map((stat, index) => (
              <div key={index} className={`unified-card light-theme stat centered ${stat.colorClass} flex-1 min-w-[140px] max-w-[200px] sm:min-w-[160px] sm:max-w-[220px] lg:min-w-[180px] lg:max-w-[240px]`}>
                <div className="unified-card-avatar">{stat.icon}</div>
                <div className="unified-card-title counter" data-target={stat.number}>
                  {stat.number}
                </div>
                <div className="unified-card-subtitle">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      */}

      {/* Why Parents Choose Chess99 Section */}
      <section className="relative bg-gradient-to-br from-blue-50 to-indigo-100 z-0">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 xl:px-12 py-12 sm:py-16 lg:py-20">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-extrabold mb-4 sm:mb-6" style={{color: 'var(--ink)'}}>
              Why Parents Choose Chess99
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed px-3 sm:px-4">
              A safe, structured and fun way for children to master chess.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="unified-card light-theme h-full">
              <div className="unified-card-avatar">👶</div>
              <h3 className="unified-card-title centered text-lg sm:text-xl">Designed for Ages 5-16</h3>
              <p className="unified-card-subtitle centered text-sm sm:text-base">Age-appropriate content and interface that grows with your child's learning level</p>
            </div>
            <div className="unified-card light-theme h-full">
              <div className="unified-card-avatar">📈</div>
              <h3 className="unified-card-title centered text-lg sm:text-xl">Step-by-Step Learning</h3>
              <p className="unified-card-subtitle centered text-sm sm:text-base">From beginner basics to advanced strategies with interactive lessons and practice</p>
            </div>
            <div className="unified-card light-theme h-full">
              <div className="unified-card-avatar">🧩</div>
              <h3 className="unified-card-title centered text-lg sm:text-xl">Daily Puzzles</h3>
              <p className="unified-card-subtitle centered text-sm sm:text-base">Build logic and critical thinking with fresh chess puzzles every day</p>
            </div>
            <div className="unified-card light-theme h-full">
              <div className="unified-card-avatar">🛡️</div>
              <h3 className="unified-card-title centered text-lg sm:text-xl">100% Safe Online Play</h3>
              <p className="unified-card-subtitle centered text-sm sm:text-base">Strict child protection, no ads, no chats, monitored environment</p>
            </div>
            <div className="unified-card light-theme h-full">
              <div className="unified-card-avatar">🚫</div>
              <h3 className="unified-card-title centered text-lg sm:text-xl">No Distractions</h3>
              <p className="unified-card-subtitle centered text-sm sm:text-base">No ads, no unsafe chats, no gambling - pure learning and safe fun</p>
            </div>
            <div className="unified-card light-theme h-full">
              <div className="unified-card-avatar">⭐</div>
              <h3 className="unified-card-title centered text-lg sm:text-xl">Teacher Approved</h3>
              <p className="unified-card-subtitle centered text-sm sm:text-base">Recommended by teachers and chess coaches across India</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-band bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 xl:px-12 py-16 sm:py-20">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-extrabold mb-4 sm:mb-6" style={{color: 'var(--ink)'}}>
              Play Chess with Other Kids
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed px-3 sm:px-4">
              Learning with ChessKid is fun! Play games, watch video lessons, and solve fun puzzles!
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-6 sm:gap-8 lg:gap-10">
            <div className="flex-1 min-w-[280px] max-w-[350px] sm:min-w-[300px] sm:max-w-[380px] lg:min-w-[320px] lg:max-w-[400px]">
              <Link
                to="/coming-soon"
                className="group"
                onClick={() => trackUI('feature_card', 'click', { feature: 'puzzles', location: 'landing_features' })}
              >
                <div className="unified-card light-theme accented h-full cursor-pointer">
                  <div className="unified-card-avatar">🧩</div>
                  <h3 className="unified-card-title centered text-lg sm:text-xl">Solve Puzzles</h3>
                  <p className="unified-card-subtitle centered text-sm sm:text-base">Challenge yourself with thousands of chess puzzles</p>
                </div>
              </Link>
            </div>
            <div className="flex-1 min-w-[280px] max-w-[350px] sm:min-w-[300px] sm:max-w-[380px] lg:min-w-[320px] lg:max-w-[400px]">
              <Link
                to="/login?resource=tutorial"
                className="group"
                onClick={() => trackUI('feature_card', 'click', { feature: 'learn', location: 'landing_features' })}
              >
                <div className="unified-card light-theme accented h-full cursor-pointer">
                  <div className="unified-card-avatar">📚</div>
                  <h3 className="unified-card-title centered text-lg sm:text-xl">Start Learning</h3>
                  <p className="unified-card-subtitle centered text-sm sm:text-base">Watch fun videos and interactive lessons</p>
                </div>
              </Link>
            </div>
            <div className="flex-1 min-w-[280px] max-w-[350px] sm:min-w-[300px] sm:max-w-[380px] lg:min-w-[320px] lg:max-w-[400px]">
              <Link
                to="/login?resource=tournaments"
                className="group"
                onClick={() => trackUI('feature_card', 'click', { feature: 'tournaments', location: 'landing_features' })}
              >
                <div className="unified-card light-theme accented h-full cursor-pointer">
                  <div className="unified-card-avatar">🏆</div>
                  <h3 className="unified-card-title centered text-lg sm:text-xl">Join Tournaments</h3>
                  <p className="unified-card-subtitle centered text-sm sm:text-base">Compete with players from around the world</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* SEO Keywords Section */}
      <section className="bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 xl:px-12">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Popular Searches We Support</h3>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3 text-sm text-gray-600">
              <span className="px-3 py-1 bg-white rounded-full border border-gray-200">Online Chess Academy for Kids</span>
              <span className="px-3 py-1 bg-white rounded-full border border-gray-200">Safe Chess App for Children</span>
              <span className="px-3 py-1 bg-white rounded-full border border-gray-200">Learn Chess Online</span>
              <span className="px-3 py-1 bg-white rounded-full border border-gray-200">Chess Puzzles for Kids</span>
              <span className="px-3 py-1 bg-white rounded-full border border-gray-200">School Chess Programs</span>
              <span className="px-3 py-1 bg-white rounded-full border border-gray-200">Chess Academy Hyderabad</span>
              <span className="px-3 py-1 bg-white rounded-full border border-gray-200">Chess Classes for Kids</span>
              <span className="px-3 py-1 bg-white rounded-full border border-gray-200">Chess Lessons for Beginners</span>
              <span className="px-3 py-1 bg-white rounded-full border border-gray-200">Fun Chess Lessons for Children</span>
            </div>
          </div>
        </div>
      </section>
      </main>

      {/* Auth Gate Modal */}
      {showAuthGate && (
        <AuthGateModal
          reason="multiplayer"
          returnTo="/lobby"
          onClose={() => setShowAuthGate(false)}
        />
      )}
    </div>
    </>
  );
};

export default LandingPage;


