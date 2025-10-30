import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { trackUI } from '../utils/analytics';
import AuthGateModal from '../components/layout/AuthGateModal';
import chessPlayingKids from '../assets/images/chess-playing-kids-crop.png';
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
    { number: '12M+', label: 'Happy Kids', icon: '😊', colorClass: 'bg-orange' },
    { number: '28,000+', label: 'Schools', icon: '🏫', colorClass: 'bg-blue' },
    { number: '91M+', label: 'Games Played', icon: '♟️', colorClass: 'bg-green' },
    { number: '113M+', label: 'Puzzles Solved', icon: '🧩', colorClass: 'bg-purple' },
    { number: '16M+', label: 'Lessons Taken', icon: '📚', colorClass: 'bg-pink' }
  ];

  return (
    <div data-page="landing" className="bg-white w-full overflow-x-hidden">
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
            <button onClick={() => navigate('/play')} className="hover:text-yellow-300 transition-colors text-sm lg:text-base font-medium">Play</button>
            <Link to="/puzzles" className="hover:text-yellow-300 transition-colors text-sm lg:text-base font-medium">Puzzles</Link>
            <Link to="/learn" className="hover:text-yellow-300 transition-colors text-sm lg:text-base font-medium">Learn</Link>
            <button className="hover:text-yellow-300 transition-colors text-sm lg:text-base font-medium">Events</button>
            <button className="hover:text-yellow-300 transition-colors text-sm lg:text-base font-medium">Resources</button>
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
              <button
                onClick={() => { navigate('/play'); setShowMobileMenu(false); }}
                className="text-left px-4 py-3 hover:bg-sky-700/50 rounded-lg transition-colors text-sm font-medium"
              >
                Play
              </button>
              <Link
                to="/puzzles"
                onClick={() => setShowMobileMenu(false)}
                className="text-left px-4 py-3 hover:bg-sky-700/50 rounded-lg transition-colors text-sm font-medium"
              >
                Puzzles
              </Link>
              <Link
                to="/learn"
                onClick={() => setShowMobileMenu(false)}
                className="text-left px-4 py-3 hover:bg-sky-700/50 rounded-lg transition-colors text-sm font-medium"
              >
                Learn
              </Link>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="text-left px-4 py-3 hover:bg-sky-700/50 rounded-lg transition-colors text-sm font-medium"
              >
                Events
              </button>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="text-left px-4 py-3 hover:bg-sky-700/50 rounded-lg transition-colors text-sm font-medium"
              >
                Resources
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* Hero Section - Top Portion Only */}
      <section className="relative overflow-hidden pt-20 sm:pt-24 bg-gradient-to-b from-sky-400 via-sky-300 to-sky-200 w-full">
        {/* Decorative clouds */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-20 left-10 w-24 h-12 bg-white rounded-full opacity-70"></div>
          <div className="absolute top-32 right-20 w-32 h-16 bg-white rounded-full opacity-60"></div>
          <div className="absolute top-48 left-1/3 w-20 h-10 bg-white rounded-full opacity-50"></div>
          <div className="absolute top-24 right-1/3 w-28 h-14 bg-white rounded-full opacity-65"></div>
        </div>

        {/* Hero Content */}
        <div className="relative w-full" style={{height: '60vh', minHeight: '500px', maxHeight: '700px'}}>
          {/* Background image with overlay */}
          <img
            src={chessPlayingKids}
            alt="Kids playing chess"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div className="hero-soft-glow" />
          <div className="absolute inset-0 bg-gradient-to-b from-sky-400/10 via-sky-300/5 to-sky-200/10"></div>

          {/* Content overlay */}
          <div className="relative z-10 h-full flex flex-col items-center justify-center px-3 sm:px-4 lg:px-8 xl:px-12 py-6 sm:py-12 lg:py-16">
            {/* Headline with dark backdrop */}
            <div className="text-center text-white mb-6 sm:mb-8 lg:mb-12 w-full max-w-4xl mx-auto mt-4 sm:mt-0">
               <div className="inline-block rounded-2xl bg-black/30 backdrop-blur-sm px-4 sm:px-6 py-3 sm:py-4 mx-2 sm:mx-0">
                 <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-2 sm:mb-3 lg:mb-4 px-2 sm:px-4">
                   India's Best Chess Site for Kids
                 </h1>
                 <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl opacity-95 px-2 sm:px-4">Learn, Play, and Have Fun with Chess!</p>
               </div>
            </div>

            {/* Quick Login Options - Mobile Optimized */}
            {!isAuthenticated && (
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
            )}

            {/* Action Buttons - Mobile Optimized */}
            <div className="flex flex-col items-center justify-center w-full px-3 sm:px-4 max-w-lg mx-auto">
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
                      Play with Computer
                    </button>
                    <button
                      onClick={() => {
                        trackUI('cta_button', 'click', { button: 'play_friends', location: 'landing_authenticated' });
                        navigate('/lobby');
                      }}
                      className="unified-card-btn secondary text-sm sm:text-base"
                    >
                      <span className="mr-2">👥</span>
                      Play with Friends
                    </button>
                  </div>
                </div>
              ) : (
                <div className="unified-card w-full max-w-sm sm:max-w-md mx-auto">
                  <h3 className="unified-card-title centered text-xl sm:text-2xl">Start Your Adventure!</h3>
                  <div className="unified-card-actions vertical">
                    <button
                      onClick={() => navigate('/play')}
                      className="unified-card-btn primary text-sm sm:text-base"
                    >
                      <span className="mr-2">🤖</span>
                      Play vs. Computer
                    </button>
                    <button
                      onClick={() => setShowAuthGate(true)}
                      className="unified-card-btn secondary text-sm sm:text-base"
                    >
                      <span className="mr-2">👥</span>
                      Play with Friends
                    </button>
                    <button
                      onClick={() => navigate('/learn')}
                      className="unified-card-btn neutral text-sm sm:text-base"
                    >
                      <span className="mr-2">📚</span>
                      Learn Chess
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-band bg-sky-50 relative">
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
                to="/puzzles"
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
                to="/learn"
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
                to="/tournaments" // Or '/play', '/lobby', etc.
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

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 xl:px-12">
          <div className="text-center">
            <p className="text-gray-400 text-xs sm:text-sm lg:text-base mb-4 sm:mb-6">© 2024 Chess99. Making Chess Fun for Kids!</p>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6 lg:gap-8">
              <Link to="/puzzles" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm lg:text-base">Puzzles</Link>
              <Link to="/learn" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm lg:text-base">Learn</Link>
              <button className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm lg:text-base">About</button>
              <button className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm lg:text-base">Contact</button>
            </div>
          </div>
        </div>
      </footer>

      {/* Auth Gate Modal */}
      {showAuthGate && (
        <AuthGateModal
          reason="multiplayer"
          returnTo="/lobby"
          onClose={() => setShowAuthGate(false)}
        />
      )}
    </div>
  );
};

export default LandingPage;
