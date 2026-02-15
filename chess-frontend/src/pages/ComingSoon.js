import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/images/logo.png';
import Footer from '../components/layout/Footer';

const ComingSoon = () => {
  return (

      <div className="min-h-screen bg-[#1a1a18] flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <img src={logo} alt="Chess99 Logo" className="h-16 w-auto mx-auto mb-6" />
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Coming Soon!
          </h1>
          <p className="text-xl md:text-2xl text-[#bababa] mb-8">
            Exciting things are being prepared for you!
          </p>
        </div>

        <div className="bg-[#312e2b] backdrop-blur-sm rounded-2xl p-8 shadow-xl border-2 border-[#3d3a37]">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🧩</div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Chess Puzzles
            </h2>
            <p className="text-[#bababa] text-lg leading-relaxed mb-6">
              Get ready to challenge yourself with thousands of exciting chess puzzles!
              We're working hard to bring you an amazing puzzle-solving experience that will
              sharpen your chess skills and make learning even more fun.
            </p>
            <div className="bg-[#e8a93e]/15 border-2 border-[#e8a93e] rounded-xl p-4 mb-6">
              <p className="text-[#f4c66a] font-medium">
                🎯 <strong>Coming Features:</strong>
              </p>
              <ul className="text-left text-[#bababa] mt-2 space-y-1">
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
              className="bg-[#4a4744] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#3d3a37] transition-colors shadow text-center"
            >
              ← Back to Home
            </Link>
            <Link
              to="/learn"
              className="bg-[#81b64c] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#a3d160] transition-colors shadow text-center"
            >
              Start Learning Chess
            </Link>
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="text-[#8b8987] text-sm">
            Want to be notified when we launch? Sign up for our newsletter!
          </p>
        </div>
      </div>

      </div>


  );
};

export default ComingSoon;