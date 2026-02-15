import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { useAuth } from '../contexts/AuthContext';
import { trackUI } from '../utils/analytics';
import AuthGateModal from '../components/layout/AuthGateModal';
import logo from '../assets/images/logo.png';
import chessPlayingKids from '../assets/images/chess-playing-kids-crop.jpeg';

// Famous "Immortal Game" (Anderssen vs Kieseritzky, 1851) moves
const IMMORTAL_GAME_MOVES = [
  'e4', 'e5', 'f4', 'exf4', 'Bc4', 'Qh4+', 'Kf1', 'b5', 'Bxb5', 'Nf6',
  'Nf3', 'Qh6', 'd3', 'Nh5', 'Nh4', 'Qg5', 'Nf5', 'c6', 'g4', 'Nf6',
  'Rg1', 'cxb5', 'h4', 'Qg6', 'h5', 'Qg5', 'Qf3', 'Ng8', 'Bxf4', 'Qf6',
  'Nc3', 'Bc5', 'Nd5', 'Qxb2', 'Bd6', 'Bxg1', 'e5', 'Qxa1+', 'Ke2', 'Na6',
  'Nxg7+', 'Kd8', 'Qf6+', 'Nxf6', 'Be7#'
];

const LandingPage = () => {
  const { isAuthenticated, loading } = useAuth();
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const navigate = useNavigate();

  // Chess animation state
  const [game, setGame] = useState(new Chess());
  const [moveIndex, setMoveIndex] = useState(0);
  const [boardPosition, setBoardPosition] = useState('start');

  // Auto-redirect authenticated users to lobby
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/lobby');
    }
  }, [loading, isAuthenticated, navigate]);

  // Animate through game moves
  useEffect(() => {
    if (moveIndex >= IMMORTAL_GAME_MOVES.length) {
      // Reset after game completes (pause then restart)
      const resetTimeout = setTimeout(() => {
        const newGame = new Chess();
        setGame(newGame);
        setMoveIndex(0);
        setBoardPosition(newGame.fen());
      }, 4000);
      return () => clearTimeout(resetTimeout);
    }

    const moveTimeout = setTimeout(() => {
      try {
        const gameCopy = new Chess(game.fen());
        const move = gameCopy.move(IMMORTAL_GAME_MOVES[moveIndex]);
        if (move) {
          setGame(gameCopy);
          setBoardPosition(gameCopy.fen());
          setMoveIndex(prev => prev + 1);
        }
      } catch {
        // If move fails, reset
        const newGame = new Chess();
        setGame(newGame);
        setMoveIndex(0);
        setBoardPosition(newGame.fen());
      }
    }, moveIndex === 0 ? 1500 : 1800);

    return () => clearTimeout(moveTimeout);
  }, [moveIndex, game]);

  const handlePlayClick = useCallback(() => {
    trackUI('cta_button', 'click', { button: 'play_now', location: 'landing_hero' });
    navigate('/play');
  }, [navigate]);

  const handleMultiplayerClick = useCallback(() => {
    trackUI('cta_button', 'click', { button: 'play_online', location: 'landing_hero' });
    setShowAuthGate(true);
  }, []);

  // Memoize board styles
  const darkSquareStyle = useMemo(() => ({ backgroundColor: '#769656' }), []);
  const lightSquareStyle = useMemo(() => ({ backgroundColor: '#eeeed2' }), []);

  return (
    <div data-page="landing" className="bg-[#1a1a18] w-full min-h-screen overflow-x-hidden flex flex-col">
      {/* Minimal Header */}
      <header className="fixed top-0 inset-x-0 z-30 h-14 bg-[#262421]/95 text-white backdrop-blur-sm border-b border-[#3d3a37]/50">
        <div className="w-full h-full px-4 lg:px-8 flex items-center justify-between max-w-7xl mx-auto">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img src={logo} alt="Chess99" className="h-7 w-auto" />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden sm:flex items-center gap-1">
            <button
              onClick={handlePlayClick}
              className="bg-[#81b64c] text-white px-5 py-1.5 rounded text-sm font-bold hover:bg-[#a3d160] transition-colors"
            >
              Play
            </button>
            {!isAuthenticated && (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="text-[#bababa] px-3 py-1.5 text-sm font-medium hover:text-white transition-colors"
                >
                  Log In
                </button>
                <button
                  onClick={() => navigate('/signup')}
                  className="bg-[#312e2b] text-white px-4 py-1.5 rounded text-sm font-semibold hover:bg-[#3d3a37] transition-colors border border-[#4a4744]"
                >
                  Sign Up
                </button>
              </>
            )}
          </nav>

          {/* Mobile Nav */}
          <div className="flex items-center gap-2 sm:hidden">
            <button
              onClick={handlePlayClick}
              className="bg-[#81b64c] text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-[#a3d160] transition-colors"
            >
              Play
            </button>
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-1.5 rounded hover:bg-[#3d3a37] transition-colors text-[#bababa]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {showMobileMenu ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {showMobileMenu && (
          <div className="absolute top-14 left-0 right-0 bg-[#262421] border-b border-[#3d3a37] shadow-lg sm:hidden">
            <nav className="flex flex-col p-3 gap-1">
              {!isAuthenticated && (
                <>
                  <button
                    onClick={() => { navigate('/login'); setShowMobileMenu(false); }}
                    className="text-left px-4 py-2.5 text-sm font-medium text-[#bababa] hover:text-white hover:bg-[#312e2b] rounded transition-colors"
                  >
                    Log In
                  </button>
                  <button
                    onClick={() => { navigate('/signup'); setShowMobileMenu(false); }}
                    className="text-left px-4 py-2.5 text-sm font-medium text-[#bababa] hover:text-white hover:bg-[#312e2b] rounded transition-colors"
                  >
                    Sign Up
                  </button>
                </>
              )}
              <button
                onClick={() => { navigate('/login?resource=tutorial'); setShowMobileMenu(false); }}
                className="text-left px-4 py-2.5 text-sm font-medium text-[#bababa] hover:text-white hover:bg-[#312e2b] rounded transition-colors"
              >
                Learn Chess
              </button>
              <button
                onClick={() => { navigate('/login?resource=tournaments'); setShowMobileMenu(false); }}
                className="text-left px-4 py-2.5 text-sm font-medium text-[#bababa] hover:text-white hover:bg-[#312e2b] rounded transition-colors"
              >
                Tournaments
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* Hero Section - Full Viewport */}
      <main className="flex-grow pt-14 flex flex-col">
        <section className="flex-grow flex items-center justify-center relative overflow-hidden">
          {/* Background image with dark overlay */}
          <img
            src={chessPlayingKids}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-[0.12]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a18]/80 via-[#262421]/70 to-[#1a1a18]/90" />

          {/* Content */}
          <div className="relative z-10 w-full max-w-6xl mx-auto px-4 py-8 sm:py-12">
            <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16">
              {/* Left: Text + CTAs */}
              <div className="text-center lg:text-left flex-shrink-0 max-w-lg">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-3 sm:mb-4 leading-tight">
                  Play Chess<br />
                  <span className="text-[#81b64c]">Online</span>
                </h1>
                <p className="text-[#bababa] text-base sm:text-lg lg:text-xl mb-6 sm:mb-8 leading-relaxed">
                  Learn, play, and improve. Safe for all ages.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                  <button
                    onClick={handlePlayClick}
                    className="bg-[#81b64c] text-white px-8 py-3 rounded-lg text-lg font-bold hover:bg-[#a3d160] transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Play Now
                  </button>
                  <button
                    onClick={handleMultiplayerClick}
                    className="bg-[#312e2b] text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-[#3d3a37] transition-all border border-[#4a4744] hover:border-[#81b64c]/50"
                  >
                    Play Online
                  </button>
                </div>

                {!isAuthenticated && (
                  <p className="mt-4 text-[#8b8987] text-sm">
                    No account needed to play vs computer
                  </p>
                )}
              </div>

              {/* Right: Animated Chessboard */}
              <div className="relative flex-shrink-0">
                {/* Glow behind board */}
                <div className="absolute -inset-4 bg-[#81b64c]/5 rounded-2xl blur-2xl" />
                <div className="relative rounded-lg overflow-hidden shadow-2xl" style={{ width: 'min(400px, calc(100vw - 48px))', height: 'min(400px, calc(100vw - 48px))' }}>
                  <Chessboard
                    position={boardPosition}
                    boardWidth={400}
                    animationDuration={600}
                    arePiecesDraggable={false}
                    customDarkSquareStyle={darkSquareStyle}
                    customLightSquareStyle={lightSquareStyle}
                    customBoardStyle={{
                      borderRadius: '4px',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Compact Feature Strip */}
        <section className="bg-[#1a1a18] border-t border-[#3d3a37]/50 py-8 sm:py-12">
          <div className="max-w-4xl mx-auto px-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <button
                onClick={handlePlayClick}
                className="group text-center p-5 rounded-xl bg-[#312e2b] border border-[#3d3a37] hover:border-[#81b64c]/40 hover:bg-[#3d3a37] transition-all"
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-[#81b64c]/15 flex items-center justify-center group-hover:bg-[#81b64c]/25 transition-colors">
                  <svg className="w-6 h-6 text-[#81b64c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-white font-semibold text-base mb-1">Play</h3>
                <p className="text-[#8b8987] text-sm">vs Computer or Friends</p>
              </button>

              <button
                onClick={() => navigate('/login?resource=tutorial')}
                className="group text-center p-5 rounded-xl bg-[#312e2b] border border-[#3d3a37] hover:border-[#e8a93e]/40 hover:bg-[#3d3a37] transition-all"
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-[#e8a93e]/15 flex items-center justify-center group-hover:bg-[#e8a93e]/25 transition-colors">
                  <svg className="w-6 h-6 text-[#e8a93e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-white font-semibold text-base mb-1">Learn</h3>
                <p className="text-[#8b8987] text-sm">Lessons & Tutorials</p>
              </button>

              <button
                onClick={() => navigate('/login?resource=tournaments')}
                className="group text-center p-5 rounded-xl bg-[#312e2b] border border-[#3d3a37] hover:border-[#769656]/40 hover:bg-[#3d3a37] transition-all"
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-[#769656]/15 flex items-center justify-center group-hover:bg-[#769656]/25 transition-colors">
                  <svg className="w-6 h-6 text-[#769656]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <h3 className="text-white font-semibold text-base mb-1">Compete</h3>
                <p className="text-[#8b8987] text-sm">Tournaments & Rankings</p>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Auth Gate Modal */}
      {showAuthGate && (
        <AuthGateModal
          reason="multiplayer"
          returnTo="/lobby"
          onClose={() => setShowAuthGate(false)}
        />
      )}
    </div>
  );
};

export default LandingPage;
