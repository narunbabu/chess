import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { trackUI } from '../utils/analytics';
import AuthGateModal from '../components/layout/AuthGateModal';
import chessPlayingKids from '../assets/images/chess-playing-kids-crop.png';
import '../styles/UnifiedCards.css';

const LandingPage = () => {
  const { isAuthenticated } = useAuth();
  const [loginType, setLoginType] = useState('guest');
  const [showAuthGate, setShowAuthGate] = useState(false);
  const navigate = useNavigate();

  const stats = [
    { number: '12M+', label: 'Happy Kids', icon: '😊', colorClass: 'bg-orange' },
    { number: '28,000+', label: 'Schools', icon: '🏫', colorClass: 'bg-blue' },
    { number: '91M+', label: 'Games Played', icon: '♟️', colorClass: 'bg-green' },
    { number: '113M+', label: 'Puzzles Solved', icon: '🧩', colorClass: 'bg-purple' },
    { number: '16M+', label: 'Lessons Taken', icon: '📚', colorClass: 'bg-pink' }
  ];

  return (
    <div data-page="landing" className="min-h-screen bg-white w-full">
      {/* Fixed Header - Dark Sky Blue */}
      <header className="fixed top-0 inset-x-0 z-30 h-16 bg-sky-600/95 text-white backdrop-blur-sm shadow">
        <div className="w-full h-full px-4 sm:px-6 lg:px-8 xl:px-12 flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-xl sm:text-2xl font-bold drop-shadow">♟️</span>
            <span className="ml-2 text-lg sm:text-xl font-bold drop-shadow">Chess99</span>
          </div>
          <nav className="flex items-center space-x-2 sm:space-x-4 lg:space-x-8">
            <button onClick={() => navigate('/play')} className="hover:text-yellow-300 transition-colors text-xs sm:text-sm lg:text-base font-medium">Play</button>
            <Link to="/puzzles" className="hover:text-yellow-300 transition-colors text-xs sm:text-sm lg:text-base font-medium">Puzzles</Link>
            <Link to="/learn" className="hover:text-yellow-300 transition-colors text-xs sm:text-sm lg:text-base font-medium">Learn</Link>
            <button className="hover:text-yellow-300 transition-colors text-xs sm:text-sm lg:text-base font-medium">Events</button>
            <button className="hover:text-yellow-300 transition-colors text-xs sm:text-sm lg:text-base font-medium">Resources</button>
          </nav>
          <div className="flex items-center space-x-2 sm:space-x-4">
            {!isAuthenticated && (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="hover:text-yellow-300 transition-colors text-sm sm:text-base font-medium"
                >
                  Login
                </button>
                <button
                  onClick={() => navigate('/signup')}
                  className="bg-yellow-400 text-gray-800 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base font-semibold hover:bg-yellow-500 transition-colors shadow"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section - Top Portion Only */}
      <section className="relative overflow-hidden pt-16 bg-gradient-to-b from-sky-400 via-sky-300 to-sky-200 w-screen ml-[calc(50%-50vw)]">
        {/* Decorative clouds */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-20 left-10 w-24 h-12 bg-white rounded-full opacity-70"></div>
          <div className="absolute top-32 right-20 w-32 h-16 bg-white rounded-full opacity-60"></div>
          <div className="absolute top-48 left-1/3 w-20 h-10 bg-white rounded-full opacity-50"></div>
          <div className="absolute top-24 right-1/3 w-28 h-14 bg-white rounded-full opacity-65"></div>
        </div>

        {/* Hero Content */}
        <div className="relative w-full" style={{height: '50vh', maxHeight: '600px'}}>
          {/* Background image with overlay */}
          <img
            src={chessPlayingKids}
            alt="Kids playing chess"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div className="hero-soft-glow" />
          <div className="absolute inset-0 bg-gradient-to-b from-sky-400/10 via-sky-300/5 to-sky-200/10"></div>

          {/* Content overlay */}
          <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 xl:px-12 py-24 lg:py-32">
            {/* Headline with dark backdrop */}
            <div className="text-center text-white mb-8 sm:mb-12 w-full">
               <div className="inline-block rounded-2xl bg-black/30 backdrop-blur-sm px-6 py-4">
                 <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 px-4">
                   India's Best Chess Site for Kids
                 </h1>
                 <p className="text-lg sm:text-xl md:text-2xl opacity-95 px-4">Learn, Play, and Have Fun with Chess!</p>
               </div>
            </div>

            {/* Quick Login Options */}
            {!isAuthenticated && (
              <div className="text-center">
                <div className="inline-flex items-center space-x-6 bg-white/90 backdrop-blur-sm rounded-xl px-8 py-4 shadow-xl border border-white/20">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="loginType"
                      value="guest"
                      className="mr-3 text-orange-500 w-4 h-4"
                      checked={loginType === 'guest'}
                      onChange={() => setLoginType('guest')}
                    />
                    <span className="text-gray-800 font-semibold">Guest</span>
                  </label>
                  <span className="text-gray-400 text-2xl">|</span>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="loginType"
                      value="login"
                      className="mr-3 text-orange-500 w-4 h-4"
                      checked={loginType === 'login'}
                      onChange={() => setLoginType('login')}
                    />
                    <span className="text-gray-800 font-semibold">Own Account</span>
                  </label>
                </div>
              </div>
            )}

            {/* Action Buttons with depth */}
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center mb-6 sm:mb-8 w-full px-4">
              {isAuthenticated ? (
                <div className="unified-card">
                  <h3 className="unified-card-title centered">Choose Your Opponent</h3>
                  <div className="unified-card-actions vertical">
                    <button
                      onClick={() => {
                        trackUI('cta_button', 'click', { button: 'play_computer', location: 'landing_authenticated' });
                        navigate('/play');
                      }}
                      className="unified-card-btn primary"
                    >
                      <span className="mr-2">🤖</span>
                      Play with Computer
                    </button>
                    <button
                      onClick={() => {
                        trackUI('cta_button', 'click', { button: 'play_friends', location: 'landing_authenticated' });
                        navigate('/lobby');
                      }}
                      className="unified-card-btn secondary"
                    >
                      <span className="mr-2">👥</span>
                      Play with Friends
                    </button>
                  </div>
                </div>
              ) : (
                <div className="unified-card max-w-sm sm:max-w-md mx-auto">
                  <h3 className="unified-card-title centered text-2xl">Start Your Adventure!</h3>
                  <div className="unified-card-actions vertical">
                    <button
                      onClick={() => navigate('/play')}
                      className="unified-card-btn primary"
                    >
                      <span className="mr-2">🤖</span>
                      Play vs. Computer
                    </button>
                    <button
                      onClick={() => setShowAuthGate(true)}
                      className="unified-card-btn secondary"
                    >
                      <span className="mr-2">👥</span>
                      Play with Friends
                    </button>
                    <button
                      onClick={() => navigate('/learn')}
                      className="unified-card-btn neutral"
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-center mb-8 lg:mb-12" style={{color: 'var(--ink)'}}>
            Our Impact in Numbers
          </h2>
          <div className="unified-card-grid cols-2 md:cols-5 gap-6 sm:gap-8">
            {stats.map((stat, index) => (
              <div key={index} className={`unified-card light-theme stat centered ${stat.colorClass}`}>
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-6" style={{color: 'var(--ink)'}}>
              Play Chess with Other Kids
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Learning with ChessKid is fun! Play games, watch video lessons, and solve fun puzzles!
            </p>
          </div>

          <div className="unified-card-grid cols-1 sm:cols-2 lg:cols-3 gap-8 lg:gap-10">
            <Link
              to="/puzzles"
              className="group"
              onClick={() => trackUI('feature_card', 'click', { feature: 'puzzles', location: 'landing_features' })}
            >
              <div className="unified-card light-theme accented h-full cursor-pointer">
                <div className="unified-card-avatar">🧩</div>
                <h3 className="unified-card-title centered">Solve Puzzles</h3>
                <p className="unified-card-subtitle centered">Challenge yourself with thousands of chess puzzles</p>
              </div>
            </Link>

            <Link
              to="/learn"
              className="group"
              onClick={() => trackUI('feature_card', 'click', { feature: 'learn', location: 'landing_features' })}
            >
              <div className="unified-card light-theme accented h-full cursor-pointer">
                <div className="unified-card-avatar">📚</div>
                <h3 className="unified-card-title centered">Start Learning</h3>
                <p className="unified-card-subtitle centered">Watch fun videos and interactive lessons</p>
              </div>
            </Link>

            <Link
              to="/tournaments" // Or '/play', '/lobby', etc.
              className="group"
              onClick={() => trackUI('feature_card', 'click', { feature: 'tournaments', location: 'landing_features' })}
            >
              <div className="unified-card light-theme accented h-full cursor-pointer">
                <div className="unified-card-avatar">🏆</div>
                <h3 className="unified-card-title centered">Join Tournaments</h3>
                <p className="unified-card-subtitle centered">Compete with players from around the world</p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="text-center">
            <p className="text-gray-400 text-sm sm:text-base mb-6">© 2024 Chess99. Making Chess Fun for Kids!</p>
            <div className="flex flex-wrap justify-center gap-6 sm:gap-8">
              <Link to="/puzzles" className="text-gray-400 hover:text-white transition-colors text-sm sm:text-base">Puzzles</Link>
              <Link to="/learn" className="text-gray-400 hover:text-white transition-colors text-sm sm:text-base">Learn</Link>
              <button className="text-gray-400 hover:text-white transition-colors text-sm sm:text-base">About</button>
              <button className="text-gray-400 hover:text-white transition-colors text-sm sm:text-base">Contact</button>
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
