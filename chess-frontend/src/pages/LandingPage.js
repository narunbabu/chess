import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AuthGateModal from '../components/layout/AuthGateModal';
import Background from '../components/layout/Background';
import chessPlayingKids from '../assets/images/chess-playing-kids-crop.png';

const LandingPage = () => {
  const { isAuthenticated } = useAuth();
  const [loginType, setLoginType] = useState('guest');
  const [showAuthGate, setShowAuthGate] = useState(false);
  const navigate = useNavigate();

  const handlePlay = () => {
    if (loginType === 'guest') {
      navigate('/play');
    } else {
      navigate('/login');
    }
  };

  const stats = [
    { number: '12M+', label: 'Happy Kids', icon: '😊' },
    { number: '28,000+', label: 'Schools', icon: '🏫' },
    { number: '91M+', label: 'Games Played', icon: '♟️' },
    { number: '113M+', label: 'Puzzles Solved', icon: '🧩' },
    { number: '16M+', label: 'Lessons Taken', icon: '📚' }
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
          <nav className="hidden md:flex items-center space-x-4 lg:space-x-8">
            <button onClick={() => navigate('/play')} className="hover:text-yellow-300 transition-colors text-sm lg:text-base font-medium">Play</button>
            <Link to="/puzzles" className="hover:text-yellow-300 transition-colors text-sm lg:text-base font-medium">Puzzles</Link>
            <Link to="/learn" className="hover:text-yellow-300 transition-colors text-sm lg:text-base font-medium">Learn</Link>
            <button className="hover:text-yellow-300 transition-colors text-sm lg:text-base font-medium">Events</button>
            <button className="hover:text-yellow-300 transition-colors text-sm lg:text-base font-medium">Resources</button>
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
          <div className="absolute inset-0 bg-gradient-to-b from-sky-400/10 via-sky-300/5 to-sky-200/10"></div>

          {/* Content overlay */}
          <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 xl:px-12 py-12">
            {/* Headline */}
            <div className="text-center text-white mb-8 sm:mb-12 w-full">
               <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 drop-shadow-2xl px-4">
                India's Chess best Site for Kids
              </h1> 
              <p className="text-lg sm:text-xl md:text-2xl opacity-95 drop-shadow-lg px-4">Learn, Play, and Have Fun with Chess!</p>
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
                <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/20">
                  <h3 className="text-xl font-semibold text-gray-800 mb-6">Choose Your Opponent</h3>
                  <div className="flex flex-col space-y-4 mb-6">
                    <button
                      onClick={() => navigate('/play')}
                      className="flex items-center justify-center w-full bg-orange-500 text-white font-bold py-3 px-6 rounded-xl hover:bg-orange-600 transition-all duration-200 shadow-lg"
                    >
                      <span className="mr-2">🤖</span>
                      Play with Computer
                    </button>
                    <button
                      onClick={() => navigate('/lobby')}
                      className="flex items-center justify-center w-full bg-blue-500 text-white font-bold py-3 px-6 rounded-xl hover:bg-blue-600 transition-all duration-200 shadow-lg"
                    >
                      <span className="mr-2">👥</span>
                      Play with Friends
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/play')}
                    className="bg-orange-500 text-white font-bold py-4 sm:py-5 px-8 sm:px-12 rounded-xl hover:bg-orange-600 transform hover:scale-105 sm:hover:scale-110 transition-all duration-200 text-lg sm:text-xl shadow-2xl backdrop-blur-sm border-2 border-orange-400"
                  >
                    🤖 Play Computer Now
                  </button>
                  <button
                    onClick={() => setShowAuthGate(true)}
                    className="bg-blue-500 text-white font-bold py-4 sm:py-5 px-8 sm:px-12 rounded-xl hover:bg-blue-600 transform hover:scale-105 sm:hover:scale-110 transition-all duration-200 text-lg sm:text-xl shadow-2xl backdrop-blur-sm border-2 border-blue-400"
                  >
                    👥 Play with Friends
                  </button>
                  <button
                    onClick={() => navigate('/learn')}
                    className="bg-white/95 backdrop-blur-sm text-orange-500 font-bold py-4 sm:py-5 px-8 sm:px-12 rounded-xl hover:bg-white transform hover:scale-105 sm:hover:scale-110 transition-all duration-200 text-lg sm:text-xl shadow-2xl border-2 border-white"
                  >
                    📚 Learn Chess
                  </button>
                </>
              )}
            </div>

            
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 sm:gap-6 lg:gap-8 text-center">
            {stats.map((stat, index) => (
              <div key={index} className="transform hover:scale-105 sm:hover:scale-110 transition-transform duration-200 py-2">
                <div className="text-3xl sm:text-4xl mb-2">{stat.icon}</div>
                <div className="text-xl sm:text-2xl font-bold text-gray-800">{stat.number}</div>
                <div className="text-gray-600 text-xs sm:text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-50">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center text-gray-800 mb-8 lg:mb-12">
            Play Chess with Other Kids
          </h2>
          <p className="text-center text-gray-600 mb-8 text-sm sm:text-base">
            Learning with ChessKid is fun! Play games, watch video lessons, and solve fun puzzles!
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            <Link to="/puzzles" className="group">
              <div className="bg-white rounded-xl p-5 sm:p-6 shadow-md hover:shadow-xl transition-shadow duration-200 h-full">
                <div className="text-3xl sm:text-4xl mb-3 sm:mb-4 text-center">🧩</div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2 text-center">Solve Puzzles</h3>
                <p className="text-sm sm:text-base text-gray-600 text-center">Challenge yourself with thousands of chess puzzles</p>
              </div>
            </Link>

            <Link to="/learn" className="group">
              <div className="bg-white rounded-xl p-5 sm:p-6 shadow-md hover:shadow-xl transition-shadow duration-200 h-full">
                <div className="text-3xl sm:text-4xl mb-3 sm:mb-4 text-center">📚</div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2 text-center">Start Learning</h3>
                <p className="text-sm sm:text-base text-gray-600 text-center">Watch fun videos and interactive lessons</p>
              </div>
            </Link>

            <button onClick={() => navigate('/play')} className="group text-left w-full">
              <div className="bg-white rounded-xl p-5 sm:p-6 shadow-md hover:shadow-xl transition-shadow duration-200 h-full">
                <div className="text-3xl sm:text-4xl mb-3 sm:mb-4 text-center">🏆</div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2 text-center">Join Tournaments</h3>
                <p className="text-sm sm:text-base text-gray-600 text-center">Compete with players from around the world</p>
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="text-center">
            <p className="text-gray-400 text-sm sm:text-base">© 2024 ChessKid. Making Chess Fun for Kids!</p>
            <div className="mt-4 flex flex-wrap justify-center gap-4 sm:gap-6">
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