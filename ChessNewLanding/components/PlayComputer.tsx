
import React from 'react';

const PlayComputer: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col justify-center items-center">
      <h1 className="text-4xl font-bold mb-8">Play Against the Computer</h1>
      <div className="flex flex-col items-center">
        <label htmlFor="difficulty" className="text-lg mb-2">Select Difficulty:</label>
        <select id="difficulty" className="bg-gray-800 text-white border border-gray-700 rounded-lg py-2 px-4">
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <button className="bg-purple-600 text-white font-semibold py-3 px-6 rounded-lg mt-8 hover:bg-purple-700 transition-colors duration-300">
          Start Game
        </button>
      </div>
    </div>
  );
};

export default PlayComputer;
