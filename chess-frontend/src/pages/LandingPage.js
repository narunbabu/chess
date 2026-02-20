import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { useAuth } from '../contexts/AuthContext';
import { trackUI } from '../utils/analytics';
import AuthGateModal from '../components/layout/AuthGateModal';
import { pieces3dLanding } from '../assets/pieces/pieces3d';
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
  const [pricingInterval, setPricingInterval] = useState('monthly');
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

  // Responsive board size - smaller on mobile so it fits in viewport
  const [boardSize, setBoardSize] = useState(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 400;
    return w < 640 ? Math.min(260, w - 48) : 400;
  });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      setBoardSize(w < 640 ? Math.min(260, w - 48) : 400);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Dark oak wood board theme
  const darkSquareStyle = useMemo(() => ({ backgroundColor: '#6B4226' }), []);
  const lightSquareStyle = useMemo(() => ({ backgroundColor: '#C9A96E' }), []);

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
            <button
              onClick={() => { const el = document.getElementById('pricing'); el && el.scrollIntoView({ behavior: 'smooth' }); }}
              className="text-[#bababa] bg-transparent border-0 px-3 py-1.5 text-sm font-medium hover:text-white transition-colors"
            >
              Pricing
            </button>
            {!isAuthenticated && (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="text-[#bababa] bg-transparent border-0 px-3 py-1.5 text-sm font-medium hover:text-white transition-colors"
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
              className="p-1.5 rounded bg-transparent border-0 hover:bg-[#3d3a37] transition-colors text-[#bababa]"
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
                    className="text-left px-4 py-2.5 text-sm font-medium text-[#bababa] bg-transparent border-0 hover:text-white hover:bg-[#312e2b] rounded transition-colors"
                  >
                    Log In
                  </button>
                  <button
                    onClick={() => { navigate('/signup'); setShowMobileMenu(false); }}
                    className="text-left px-4 py-2.5 text-sm font-medium text-[#bababa] bg-transparent border-0 hover:text-white hover:bg-[#312e2b] rounded transition-colors"
                  >
                    Sign Up
                  </button>
                </>
              )}
              <button
                onClick={() => { navigate('/login?resource=tutorial'); setShowMobileMenu(false); }}
                className="text-left px-4 py-2.5 text-sm font-medium text-[#bababa] bg-transparent border-0 hover:text-white hover:bg-[#312e2b] rounded transition-colors"
              >
                Learn Chess
              </button>
              <button
                onClick={() => { navigate('/login?resource=tournaments'); setShowMobileMenu(false); }}
                className="text-left px-4 py-2.5 text-sm font-medium text-[#bababa] bg-transparent border-0 hover:text-white hover:bg-[#312e2b] rounded transition-colors"
              >
                Tournaments
              </button>
              <button
                onClick={() => { const el = document.getElementById('pricing'); if (el) { el.scrollIntoView({ behavior: 'smooth' }); setShowMobileMenu(false); } else { navigate('/pricing'); setShowMobileMenu(false); } }}
                className="text-left px-4 py-2.5 text-sm font-medium text-[#bababa] bg-transparent border-0 hover:text-white hover:bg-[#312e2b] rounded transition-colors"
              >
                Pricing
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
                </div>

                {!isAuthenticated && (
                  <p className="mt-4 text-[#8b8987] text-sm">
                    No account needed to play vs computer
                  </p>
                )}
              </div>

              {/* Right: Animated Chessboard */}
              <div className="relative flex-shrink-0">
                {/* Warm glow behind board */}
                <div className="absolute -inset-6 bg-[#C9A96E]/8 rounded-2xl blur-3xl" />
                <div
                  className="relative rounded-sm"
                  style={{
                    width: boardSize,
                    height: boardSize,
                    boxShadow: '0 0 0 4px #3d2b1a, 0 0 0 6px #2a1d10, 0 8px 32px rgba(0,0,0,0.6)',
                  }}
                >
                  <Chessboard
                    position={boardPosition}
                    boardWidth={boardSize}
                    animationDuration={600}
                    arePiecesDraggable={false}
                    customDarkSquareStyle={darkSquareStyle}
                    customLightSquareStyle={lightSquareStyle}
                    customPieces={pieces3dLanding}
                    customBoardStyle={{
                      borderRadius: '2px',
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
        {/* Pricing Section */}
        <section id="pricing" className="bg-[#262421] border-t border-[#3d3a37]/50 py-12 sm:py-16">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-2">Simple Pricing</h2>
            <p className="text-[#bababa] text-center mb-8 text-base">Start free. Upgrade anytime.</p>

            {/* Interval Toggle */}
            <div className="flex items-center justify-center gap-2 mb-8">
              <button
                onClick={() => setPricingInterval('monthly')}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${pricingInterval === 'monthly' ? 'bg-[#81b64c] text-white' : 'bg-[#312e2b] text-[#bababa] hover:text-white border border-[#4a4744]'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setPricingInterval('yearly')}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${pricingInterval === 'yearly' ? 'bg-[#81b64c] text-white' : 'bg-[#312e2b] text-[#bababa] hover:text-white border border-[#4a4744]'}`}
              >
                Yearly
                <span className="bg-[#e8a93e] text-[#1a1a18] text-xs px-1.5 py-0.5 rounded font-bold">Save 16%</span>
              </button>
            </div>

            {/* Tier Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {/* Free */}
              <div className="rounded-xl bg-[#312e2b] border border-[#3d3a37] p-6 flex flex-col">
                <div className="mb-4">
                  <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-[#3d3a37] text-[#bababa] mb-3">Free</span>
                  <div className="text-3xl font-bold text-white">₹0</div>
                  <div className="text-[#8b8987] text-sm mt-1">Forever free</div>
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {['Play vs computer', '5 games/day online', 'Public tournaments', 'Basic game stats', '5 undos per game'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-[#bababa]">
                      <span className="text-[#81b64c] flex-shrink-0">✓</span>{f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handlePlayClick}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold bg-[#3d3a37] text-white hover:bg-[#4a4744] transition-colors border border-[#4a4744]"
                >
                  Play Now
                </button>
              </div>

              {/* Silver */}
              <div className="rounded-xl bg-[#312e2b] border-2 border-[#81b64c] p-6 flex flex-col relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-[#81b64c] text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">Most Popular</span>
                </div>
                <div className="mb-4">
                  <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-[#81b64c]/20 text-[#81b64c] mb-3">Silver</span>
                  <div className="text-3xl font-bold text-white">
                    ₹{pricingInterval === 'monthly' ? '99' : '999'}
                  </div>
                  <div className="text-[#8b8987] text-sm mt-1">
                    {pricingInterval === 'monthly' ? 'per month' : 'per year · save ₹189'}
                  </div>
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {['Unlimited games', 'All tournaments', 'ELO tracking', 'Full game history', 'Ad-free experience', 'Priority matchmaking', 'Custom board themes', 'Puzzle & Opening Trainer'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-[#bababa]">
                      <span className="text-[#81b64c] flex-shrink-0">✓</span>{f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/pricing"
                  className="w-full py-2.5 rounded-lg text-sm font-bold bg-[#81b64c] text-white hover:bg-[#a3d160] transition-colors text-center block"
                >
                  Get Silver
                </Link>
              </div>

              {/* Gold */}
              <div className="rounded-xl bg-[#312e2b] border border-[#e8a93e]/50 p-6 flex flex-col">
                <div className="mb-4">
                  <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-[#e8a93e]/20 text-[#e8a93e] mb-3">Gold</span>
                  <div className="text-3xl font-bold text-white">
                    ₹{pricingInterval === 'monthly' ? '499' : '4,999'}
                  </div>
                  <div className="text-[#8b8987] text-sm mt-1">
                    {pricingInterval === 'monthly' ? 'per month' : 'per year · save ₹989'}
                  </div>
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {['Everything in Silver', 'Org/school affiliation', 'AI opponent', 'Opening explorer', 'Advanced analytics', 'Priority support', 'Game annotations', 'Full training suite'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-[#bababa]">
                      <span className="text-[#e8a93e] flex-shrink-0">✓</span>{f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/pricing"
                  className="w-full py-2.5 rounded-lg text-sm font-bold bg-[#e8a93e] text-[#1a1a18] hover:bg-[#f0c060] transition-colors text-center block"
                >
                  Get Gold
                </Link>
              </div>
            </div>

            <div className="text-center mt-8">
              <Link to="/pricing" className="text-[#81b64c] text-sm hover:underline">
                View full feature comparison →
              </Link>
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
