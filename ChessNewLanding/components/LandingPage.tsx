
import React from 'react';
import { Link } from 'react-router-dom';

const GameModeCard: React.FC<{ title: string; description: string; link: string; linkText: string }> = ({ title, description, link, linkText }) => (
  <div className="bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-700 rounded-xl p-4 sm:p-6 lg:p-8 h-full flex flex-col transform hover:scale-105 hover:border-purple-500 transition-all duration-300 shadow-lg">
    <div className="flex-1 flex flex-col">
      <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-2 sm:mb-3">{title}</h3>
      <p className="text-sm sm:text-base text-gray-400 mb-4 sm:mb-6 flex-1">{description}</p>
    </div>
    <Link
      to={link}
      className="inline-block bg-purple-600 text-white font-semibold py-2 sm:py-3 px-4 sm:px-6 rounded-lg text-sm sm:text-base hover:bg-purple-700 transition-colors duration-300 shadow-md hover:shadow-lg text-center"
    >
      {linkText}
    </Link>
  </div>
);

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white relative overflow-hidden">
      {/* Background pattern */}
      <div
        className="absolute inset-0 z-0 opacity-10"
        style={{
          backgroundImage: 'radial-gradient(#4a5568 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      ></div>

      {/* Gradient overlays */}
      <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-gradient-to-br from-purple-900 via-transparent to-transparent opacity-20 blur-3xl"></div>
      <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-gradient-to-tl from-indigo-900 via-transparent to-transparent opacity-20 blur-3xl"></div>

      {/* Main content container */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header section */}
        <div className="flex-1 flex flex-col justify-center items-center px-4 py-8 sm:py-12 lg:py-16">
          <div className="text-center max-w-5xl mx-auto">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold mb-4 sm:mb-6 animate-[cardSlideIn_0.8s_ease-out] leading-tight">
              Master Chess at Your Own Pace
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-300 max-w-4xl mx-auto mb-6 sm:mb-8 animate-[cardSlideIn_0.9s_ease-out] px-4">
              Improve your chess skills through practice, puzzles, and guided learning - no registration required to start playing.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center animate-[cardSlideIn_1.0s_ease-out] px-4">
              <Link
                to="/play"
                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 px-6 sm:px-8 rounded-full text-base sm:text-lg hover:scale-105 transform transition-transform duration-300 shadow-lg"
              >
                Play Now
              </Link>
              <Link
                to="/history"
                className="bg-gray-700 text-gray-200 font-bold py-3 px-6 sm:px-8 rounded-full text-base sm:text-lg hover:bg-gray-600 transform transition-colors duration-300 shadow-lg"
              >
                Previous Games
              </Link>
            </div>
          </div>
        </div>

        {/* Cards section */}
        <div className="flex-shrink-0 px-4 pb-8 sm:pb-12 lg:pb-16">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 animate-[cardSlideIn_1.1s_ease-out]">
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
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
