import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const LandingPage: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginType, setLoginType] = useState('guest');
  const navigate = useNavigate();

  const handlePlay = () => {
    if (loginType === 'guest') {
      navigate('/play-computer');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white relative overflow-hidden">
      <div
        className="absolute inset-0 z-0 opacity-10"
        style={{
          backgroundImage: 'url(/chess-overlay.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      ></div>

      <div className="relative z-10 flex flex-col justify-center items-center min-h-screen">
        {isLoggedIn ? (
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-8">Welcome Back!</h1>
            <div className="flex justify-center items-center space-x-4 mb-8">
              <label className="flex items-center">
                <input type="radio" name="playWith" value="human" className="mr-2" />
                With Human
              </label>
              <label className="flex items-center">
                <input type="radio" name="playWith" value="computer" className="mr-2" defaultChecked />
                With Computer
              </label>
              <label className="flex items-center">
                <input type="radio" name="playWith" value="ai" className="mr-2" />
                With AI
              </label>
            </div>
            <button
              onClick={() => navigate('/play')}
              className="bg-purple-600 text-white font-semibold py-3 px-8 rounded-lg hover:bg-purple-700 transition-colors duration-300"
            >
              Play
            </button>
          </div>
        ) : (
          <div className="text-center">
            <div className="flex justify-center items-center space-x-4 mb-8">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="loginType"
                  value="guest"
                  className="mr-2"
                  checked={loginType === 'guest'}
                  onChange={() => setLoginType('guest')}
                />
                Guest Login
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="loginType"
                  value="login"
                  className="mr-2"
                  checked={loginType === 'login'}
                  onChange={() => setLoginType('login')}
                />
                Login
              </label>
            </div>
            <button
              onClick={handlePlay}
              className="bg-purple-600 text-white font-semibold py-3 px-8 rounded-lg hover:bg-purple-700 transition-colors duration-300 mb-8"
            >
              Play
            </button>
            <div className="flex justify-center space-x-4">
              <Link to="/puzzles" className="text-gray-400 hover:text-white">Solve Puzzles</Link>
              <Link to="/learn" className="text-gray-400 hover:text-white">Start Learning</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LandingPage;