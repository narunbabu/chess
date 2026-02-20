import React from 'react';
import { Link } from 'react-router-dom';

const Puzzles = () => {
  return (
    <div className="min-h-screen bg-[#262421] text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-6">♟️</div>
        <h1 className="text-3xl font-bold text-white mb-3">Puzzles — Coming Soon</h1>
        <p className="text-[#bababa] mb-6 leading-relaxed">
          We're building a puzzle library with thousands of tactics for all levels.
          Stay tuned!
        </p>
        <ul className="text-left text-[#8b8987] text-sm space-y-2 mb-8 bg-[#312e2b] rounded-lg p-4">
          <li>• Thousands of puzzles for all skill levels</li>
          <li>• Progressive difficulty tracking</li>
          <li>• Daily puzzle challenges</li>
          <li>• Achievement system and rewards</li>
        </ul>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/training"
            className="bg-[#81b64c] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#a3d160] transition-colors"
          >
            Try Training Exercises
          </Link>
          <Link
            to="/tutorial"
            className="bg-[#312e2b] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#3d3a37] transition-colors border border-[#4a4744]"
          >
            Go to Lessons
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Puzzles;
