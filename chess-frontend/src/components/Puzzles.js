import React from 'react';
import { Link } from 'react-router-dom';

const Puzzles = () => {
  return (
    <div className="min-h-screen bg-[#262421] text-white flex flex-col items-center justify-start p-6 pt-12">
      <div className="max-w-2xl w-full text-center">
        <div className="text-6xl mb-6">♟️</div>
        <h1 className="text-4xl font-bold text-white mb-3">Chess Puzzles</h1>
        <p className="text-[#bababa] mb-10 leading-relaxed">
          Sharpen your tactical vision and calculation depth. Our structured training program
          takes you from 1600 to 2200 ELO through progressive stages and guided thinking.
        </p>

        {/* Featured: Tactical Trainer */}
        <Link
          to="/tactical-trainer"
          className="block rounded-3xl p-8 mb-6 text-left transition-all duration-200 hover:scale-[1.01] no-underline"
          style={{
            backgroundColor: '#312e2b',
            border: '2px solid #81b64c',
            boxShadow: '0 0 30px #81b64c22',
            textDecoration: 'none',
          }}
        >
          <div className="flex items-start gap-4">
            <div className="text-3xl p-3 rounded-2xl flex-shrink-0 bg-[#81b64c22]">
              🎯
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest mb-1 text-[#81b64c]">
                Featured · 200 Lichess Puzzles
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Tactical Progression Trainer
              </h2>
              <p className="text-[#bababa] text-sm leading-relaxed mb-4">
                A structured 4-stage thinking trainer. Each puzzle requires you to identify
                candidate moves and opponent threats before you solve — teaching real chess
                thinking, not just pattern-matching.
              </p>
              <div className="flex flex-wrap gap-2">
                {['1600 → 2200 ELO', 'Guided Thinking Mode', '4 Stages', 'Lichess Database'].map(tag => (
                  <span
                    key={tag}
                    className="text-xs font-medium px-2.5 py-1 rounded-md bg-[#81b64c22] text-[#81b64c]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-5 py-3 rounded-xl text-center font-bold text-white bg-[#81b64c]">
            Start Training →
          </div>
        </Link>

        {/* Coming soon items */}
        <div className="rounded-2xl p-6 text-left bg-[#312e2b] border border-[#4a4744] mb-8">
          <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-[#8b8987]">
            Coming Soon
          </h3>
          <ul className="space-y-3 text-[#8b8987]">
            {[
              '📅 Daily puzzle challenges',
              '🎲 Random puzzle mode (all ELO ranges)',
              '📊 Themed puzzle sets (endgames, openings, mating patterns)',
              '🏆 Puzzle rating system tied to your Chess99 account',
            ].map(item => (
              <li key={item} className="text-sm">{item}</li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/training"
            className="bg-[#312e2b] text-[#bababa] px-6 py-3 rounded-lg font-semibold hover:bg-[#3d3a37] transition-colors border border-[#4a4744]"
          >
            Training Exercises
          </Link>
          <Link
            to="/tutorial"
            className="bg-[#312e2b] text-[#bababa] px-6 py-3 rounded-lg font-semibold hover:bg-[#3d3a37] transition-colors border border-[#4a4744]"
          >
            Interactive Lessons
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Puzzles;
