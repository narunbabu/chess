
import React from 'react';
import { Link } from 'react-router-dom';

const GameModeCard: React.FC<{ title: string; description: string; link: string; linkText: string }> = ({ title, description, link, linkText }) => (
  <div className="bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 transform hover:scale-105 hover:border-purple-500 transition-all duration-300 shadow-lg">
    <h3 className="text-2xl font-bold text-white mb-3">{title}</h3>
    <p className="text-gray-400 mb-6">{description}</p>
    <Link to={link} className="inline-block bg-purple-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-purple-700 transition-colors duration-300 shadow-md hover:shadow-lg">
      {linkText}
    </Link>
  </div>
);

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6 overflow-hidden relative">
      <div 
        className="absolute inset-0 z-0 opacity-10" 
        style={{
          backgroundImage: 'radial-gradient(#4a5568 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      ></div>
      <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-gradient-to-br from-purple-900 via-transparent to-transparent opacity-20 blur-3xl"></div>
      <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-gradient-to-tl from-indigo-900 via-transparent to-transparent opacity-20 blur-3xl"></div>
      
      <div className="text-center z-10">
        <h1 className="text-5xl md:text-7xl font-extrabold mb-4 animate-[cardSlideIn_0.8s_ease-out]">
          Master Chess at Your Own Pace
        </h1>
        <p className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto mb-8 animate-[cardSlideIn_0.9s_ease-out]">
          Improve your chess skills through practice, puzzles, and guided learning - no registration required to start playing.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-[cardSlideIn_1.0s_ease-out]">
          <Link to="/play" className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 px-8 rounded-full text-lg hover:scale-105 transform transition-transform duration-300 shadow-lg">
            Play Now
          </Link>
          <Link to="/history" className="bg-gray-700 text-gray-200 font-bold py-3 px-8 rounded-full text-lg hover:bg-gray-600 transform transition-colors duration-300 shadow-lg">
            Previous Games
          </Link>
        </div>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8 mt-20 max-w-6xl w-full z-10 animate-[cardSlideIn_1.1s_ease-out]">
        <GameModeCard 
          title="Play vs Computer"
          description="Challenge the computer at different difficulty levels, from beginner to advanced."
          link="/play"
          linkText="Play Game"
        />
        <GameModeCard 
          title="Puzzles & Exercises"
          description="Solve chess puzzles organized by skill level to improve your tactical vision."
          link="/training"
          linkText="Start Training"
        />
        <GameModeCard 
          title="Tutorial Mode"
          description="Learn the rules and basic strategies of chess."
          link="/training/beginner/1"
          linkText="Learn More"
        />
      </div>
    </div>
  );
};

export default LandingPage;
