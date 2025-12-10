import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/images/logo.png';
import Footer from '../components/layout/Footer';

const ComingSoon = () => {
  return (

      <div className="min-h-screen bg-gradient-to-br from-sky-400 via-sky-300 to-sky-200 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <img src={logo} alt="Chess99 Logo" className="h-16 w-auto mx-auto mb-6" />
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Coming Soon!
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8">
            Exciting things are being prepared for you!
          </p>
        </div>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 shadow-xl border-2 border-white/20">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🧩</div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">
              Chess Puzzles
            </h2>
            <p className="text-gray-600 text-lg leading-relaxed mb-6">
              Get ready to challenge yourself with thousands of exciting chess puzzles!
              We're working hard to bring you an amazing puzzle-solving experience that will
              sharpen your chess skills and make learning even more fun.
            </p>
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 mb-6">
              <p className="text-gray-700 font-medium">
                🎯 <strong>Coming Features:</strong>
              </p>
              <ul className="text-left text-gray-600 mt-2 space-y-1">
                <li>• Thousands of puzzles for all skill levels</li>
                <li>• Progressive difficulty tracking</li>
                <li>• Daily puzzle challenges</li>
                <li>• Achievement system and rewards</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/"
              className="bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors shadow text-center"
            >
              ← Back to Home
            </Link>
            <Link
              to="/learn"
              className="bg-sky-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-sky-600 transition-colors shadow text-center"
            >
              Start Learning Chess
            </Link>
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="text-white/80 text-sm">
            Want to be notified when we launch? Sign up for our newsletter!
          </p>
        </div>
      </div>

      </div>


  );
};

export default ComingSoon;