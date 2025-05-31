// src/pages/LandingPage.js 
import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <div className="landing-page">
      <div className="chess-pattern"></div>
      
      <h1 className="landing-title">Master Chess at Your Own Pace</h1>
      <p className="landing-subtitle">
        Improve your chess skills through practice, puzzles, and guided learning - 
        no registration required to start playing.
      </p>
      
      <Link to="/play" className="play-button">
        Play Now
      </Link>
      <Link to="/history" className="history-button">Previous Games</Link>
      
      <div className="game-modes">
  <div className="game-mode-card">
    <h3 className="game-mode-title">Play vs Computer</h3>
    <p className="game-mode-description">
      Challenge the computer at different difficulty levels, from beginner to advanced.
    </p>
    <Link to="/play" className="game-mode-button">Play Game</Link>
  </div>

  <div className="game-mode-card">
    <h3 className="game-mode-title">Puzzles & Exercises</h3>
    <p className="game-mode-description">
      Solve chess puzzles organized by skill level to improve your tactical vision.
    </p>
    <Link to="/training" className="game-mode-button">Start Training</Link>
  </div>

  <div className="game-mode-card">
    <h3 className="game-mode-title">Tutorial Mode</h3>
    <p className="game-mode-description">
      Learn the rules and basic strategies of chess.
    </p>
    <Link to="/training/beginner/1" className="game-mode-button">Learn More</Link>
  </div>
</div>

    </div>
  );
};

export default LandingPage;