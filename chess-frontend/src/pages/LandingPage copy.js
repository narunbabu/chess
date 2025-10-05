import React, { useState } from 'react';

const LandingPage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginType, setLoginType] = useState('guest');

  const handlePlay = () => {
    if (loginType === 'guest') {
      console.log('Navigate to /play');
    } else {
      console.log('Navigate to /login');
    }
  };

  const handleNavigation = (path) => {
    console.log(`Navigate to ${path}`);
  };

  const stats = [
    { number: '12M+', label: 'Happy Kids', icon: '😊' },
    { number: '28,000+', label: 'Schools', icon: '🏫' },
    { number: '91M+', label: 'Games Played', icon: '♟️' },
    { number: '113M+', label: 'Puzzles Solved', icon: '🧩' },
    { number: '16M+', label: 'Lessons Taken', icon: '📚' }
  ];

  return (
    <div data-page="landing" className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-yellow-500">♟️</span>
              <span className="ml-2 text-xl font-bold text-gray-800">ChessKid</span>
            </div>
            <nav className="hidden md:flex space-x-8">
              <button onClick={() => handleNavigation('/play')} className="text-gray-600 hover:text-gray-900">Play</button>
              <button onClick={() => handleNavigation('/puzzles')} className="text-gray-600 hover:text-gray-900">Puzzles</button>
              <button onClick={() => handleNavigation('/learn')} className="text-gray-600 hover:text-gray-900">Learn</button>
              <button className="text-gray-600 hover:text-gray-900">Events</button>
              <button className="text-gray-600 hover:text-gray-900">Resources</button>
            </nav>
            <div className="flex items-center space-x-4">
              {!isAuthenticated && (
                <>
                  <button 
                    onClick={() => handleNavigation('/login')}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Login
                  </button>
                  <button 
                    onClick={() => handleNavigation('/signup')}
                    className="bg-yellow-400 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:bg-yellow-500 transition-colors"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-400 via-blue-300 to-blue-200">
        <div className="absolute inset-0">
          {/* Decorative clouds */}
          <div className="absolute top-10 left-10 w-24 h-12 bg-white rounded-full opacity-70"></div>
          <div className="absolute top-20 right-20 w-32 h-16 bg-white rounded-full opacity-60"></div>
          <div className="absolute top-32 left-1/3 w-20 h-10 bg-white rounded-full opacity-50"></div>
          <div className="absolute top-8 right-1/3 w-28 h-14 bg-white rounded-full opacity-65"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center text-white mb-12">
            <h1 className="text-5xl md:text-6xl font-bold mb-4">
              The #1 Chess Site for Kids
            </h1>
            <p className="text-xl opacity-95">Learn, Play, and Have Fun with Chess!</p>
          </div>

          {/* Main Image Area */}
          <div className="relative h-64 md:h-80 mb-12 rounded-2xl overflow-hidden bg-gradient-to-b from-green-400 to-green-500">
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Placeholder for chess-playing-kids image */}
              <div className="text-center">
                <div className="flex justify-center space-x-8 mb-4">
                  <div className="text-6xl animate-bounce" style={{animationDelay: '0.1s'}}>👦</div>
                  <div className="text-6xl animate-bounce" style={{animationDelay: '0.2s'}}>♟️</div>
                  <div className="text-6xl animate-bounce" style={{animationDelay: '0.3s'}}>👧</div>
                </div>
                <p className="text-white text-lg font-semibold">Kids Playing Chess</p>
                <p className="text-white/80 text-sm">(Image: chess-playing-kids-crop.png)</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
            {isAuthenticated ? (
              <>
                <div className="bg-white/95 rounded-xl p-6 shadow-lg">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Choose Your Opponent</h3>
                  <div className="flex flex-col space-y-3 mb-4">
                    <label className="flex items-center cursor-pointer">
                      <input type="radio" name="playWith" value="computer" className="mr-3 text-orange-500" defaultChecked />
                      <span className="text-gray-700">🤖 Play with Computer</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input type="radio" name="playWith" value="human" className="mr-3 text-orange-500" />
                      <span className="text-gray-700">👥 Play with Friends</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input type="radio" name="playWith" value="ai" className="mr-3 text-orange-500" />
                      <span className="text-gray-700">🧠 Play with AI Coach</span>
                    </label>
                  </div>
                  <button
                    onClick={() => handleNavigation('/play')}
                    className="w-full bg-orange-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-orange-600 transform hover:scale-105 transition-all duration-200 text-lg"
                  >
                    Start Playing!
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleNavigation('/play')}
                  className="bg-orange-500 text-white font-bold py-4 px-8 rounded-lg hover:bg-orange-600 transform hover:scale-105 transition-all duration-200 text-lg shadow-lg"
                >
                  Play Now
                </button>
                <button
                  onClick={() => handleNavigation('/learn')}
                  className="bg-white text-orange-500 font-bold py-4 px-8 rounded-lg hover:bg-gray-50 transform hover:scale-105 transition-all duration-200 text-lg shadow-lg"
                >
                  Learn Chess
                </button>
              </>
            )}
          </div>

          {/* Quick Login Options for Non-authenticated */}
          {!isAuthenticated && (
            <div className="mt-8 text-center">
              <div className="inline-flex items-center space-x-4 bg-white/90 rounded-lg px-6 py-3">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="loginType"
                    value="guest"
                    className="mr-2 text-orange-500"
                    checked={loginType === 'guest'}
                    onChange={() => setLoginType('guest')}
                  />
                  <span className="text-gray-700 font-medium">Play as Guest</span>
                </label>
                <span className="text-gray-400">|</span>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="loginType"
                    value="login"
                    className="mr-2 text-orange-500"
                    checked={loginType === 'login'}
                    onChange={() => setLoginType('login')}
                  />
                  <span className="text-gray-700 font-medium">Login to Account</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 text-center">
            {stats.map((stat, index) => (
              <div key={index} className="transform hover:scale-110 transition-transform duration-200">
                <div className="text-4xl mb-2">{stat.icon}</div>
                <div className="text-2xl font-bold text-gray-800">{stat.number}</div>
                <div className="text-gray-600 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
            Play Chess with Other Kids
          </h2>
          <p className="text-center text-gray-600 mb-8">
            Learning with ChessKid is fun! Play games, watch video lessons, and solve fun puzzles!
          </p>
          
          <div className="grid md:grid-cols-3 gap-8">
            <button onClick={() => handleNavigation('/puzzles')} className="group text-left">
              <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow duration-200">
                <div className="text-4xl mb-4 text-center">🧩</div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Solve Puzzles</h3>
                <p className="text-gray-600">Challenge yourself with thousands of chess puzzles</p>
              </div>
            </button>
            
            <button onClick={() => handleNavigation('/learn')} className="group text-left">
              <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow duration-200">
                <div className="text-4xl mb-4 text-center">📚</div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Start Learning</h3>
                <p className="text-gray-600">Watch fun videos and interactive lessons</p>
              </div>
            </button>
            
            <button onClick={() => handleNavigation('/play')} className="group text-left">
              <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow duration-200">
                <div className="text-4xl mb-4 text-center">🏆</div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Join Tournaments</h3>
                <p className="text-gray-600">Compete in fun tournaments and challenges</p>
              </div>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;