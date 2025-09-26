import React from 'react';
import { Link } from 'react-router-dom';
// Import some icons for the feature cards
import { FaChessPawn, FaPuzzlePiece, FaGraduationCap, FaPlay } from 'react-icons/fa';
import Background from '../components/layout/Background';


// A redesigned, more visual feature card component
const FeatureCard = ({ icon, title, description, link, linkText, gradient }) => (
  <div className="group relative overflow-hidden bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 border border-white/20">
    <div className={`absolute inset-0 ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`}></div>
    <div className="relative z-10">
      <div className="text-4xl inline-block p-3 rounded-full mb-4 bg-white/20 backdrop-blur-sm shadow-inner">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
      <p className="text-slate-300 mb-6 leading-relaxed text-sm">{description}</p>
      <Link
        to={link}
        className="inline-flex items-center gap-2 bg-accent text-white font-semibold py-2 px-6 rounded-full text-sm hover:bg-accent-600 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
      >
        <FaPlay className="text-xs" />
        {linkText}
      </Link>
    </div>
  </div>
);

const LandingPage = () => {
  return (
    <div data-page="landing" className="fixed inset-0 w-screen h-screen font-display overflow-hidden">
      <Background />
      {/* Hero Section */}
      <div className="relative z-10 flex items-center justify-center h-full">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-4xl mx-auto">
            <div className="mb-6 animate-cardSlideIn">
              <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-full px-5 py-2 shadow-lg mb-4 border border-white/20">
                
                <span className="text-white font-semibold text-sm">Welcome to Chess Mastery</span>
                
              </div>
            </div>

            <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-accent leading-tight mb-4 animate-cardSlideIn" style={{ animationDelay: '0.1s' }}>
              Master Chess
              <br />
              <span className="text-4xl md:text-6xl">One Move at a Time</span>
            </h1>

            <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-8 leading-relaxed animate-cardSlideIn" style={{ animationDelay: '0.2s' }}>
              Embark on your chess journey with interactive lessons, challenging puzzles, and AI opponents.
              From beginner to grandmaster, we'll guide your every move.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-cardSlideIn" style={{ animationDelay: '0.3s' }}>
              <Link
                to="/play"
                className="group inline-flex items-center gap-3 bg-accent text-white font-bold py-4 px-10 rounded-full text-lg hover:bg-accent-600 transform transition-all duration-300 shadow-2xl hover:shadow-primary-500/25 hover:scale-105"
              >
                <FaPlay className="text-base group-hover:translate-x-1 transition-transform" />
                Start Playing
              </Link>

              <Link
                to="/training"
                className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm text-white border-2 border-white/20 font-bold py-4 px-10 rounded-full text-lg hover:bg-white/20 hover:border-white/40 hover:scale-105 transform transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                <FaPuzzlePiece className="text-primary-500" />
                Learn & Practice
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/20 backdrop-blur-sm py-8">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <FeatureCard
              icon={<FaChessPawn className="text-secondary" />}
              gradient="bg-gradient-to-br from-secondary to-primary"
              title="Play & Compete"
              description="Challenge our AI opponents at different skill levels. Practice makes perfect in our interactive game environment."
              link="/play"
              linkText="Start Game"
            />
            <FeatureCard
              icon={<FaPuzzlePiece className="text-primary-600" />}
              gradient="bg-gradient-to-br from-primary-600 to-accent"
              title="Solve Puzzles"
              description="Sharpen your tactical vision with thousands of chess puzzles, from beginner-friendly to grandmaster level."
              link="/training"
              linkText="Solve Puzzles"
            />
            <FeatureCard
              icon={<FaGraduationCap className="text-accent" />}
              gradient="bg-gradient-to-br from-accent to-secondary"
              title="Learn Fundamentals"
              description="Master chess from the ground up with our comprehensive tutorials and interactive lessons."
              link="/training/beginner/1"
              linkText="Start Learning"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;