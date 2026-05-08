import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';
import { trackUI } from '../utils/analytics';
import AuthGateModal from '../components/layout/AuthGateModal';
import PlayModeGuide from '../components/onboarding/PlayModeGuide';
import IntroVideo from '../components/onboarding/IntroVideo';
import { ONBOARDING_GUIDE_GROUPS } from '../data/onboardingPlayModes';
import logo from '../assets/images/logo.png';
import chessPlayingKids from '../assets/images/chess-playing-kids-crop.jpeg';

const LandingPage = () => {
  const { isAuthenticated, loading } = useAuth();
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [showPlayChoice, setShowPlayChoice] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [pricingInterval, setPricingInterval] = useState('monthly');
  const navigate = useNavigate();

  // Auto-redirect authenticated users to lobby
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/lobby');
    }
  }, [loading, isAuthenticated, navigate]);

  const handlePlayClick = useCallback(() => {
    trackUI('cta_button', 'click', { button: 'play_now', location: 'landing_hero' });
    if (!isAuthenticated) {
      setShowPlayChoice(true);
      setShowMobileMenu(false);
      return;
    }
    navigate('/play');
  }, [isAuthenticated, navigate]);

  const handleGuestPlay = useCallback(() => {
    trackUI('cta_button', 'click', { button: 'play_as_guest', location: 'landing_play_choice' });
    setShowPlayChoice(false);
    navigate('/play', {
      state: {
        guestMode: true,
        ratedMode: 'casual',
        computerDepth: 3,
      },
    });
  }, [navigate]);

  const handleLoginPlay = useCallback(() => {
    trackUI('cta_button', 'click', { button: 'login_to_play', location: 'landing_play_choice' });
    setShowPlayChoice(false);
    navigate('/login');
  }, [navigate]);

  const handleGuideAction = useCallback((item) => {
    trackUI('onboarding_guide', 'click', { item: item.id, location: 'landing' });

    if (item.requiresAuth && !isAuthenticated) {
      if (item.group === 'learn') {
        navigate('/login?resource=tutorial');
        return;
      }
      setShowAuthGate(true);
      return;
    }

    if (item.action === 'openMatchmaking') {
      navigate('/lobby');
      return;
    }

    navigate(item.path || '/', item.state ? { state: item.state } : undefined);
  }, [isAuthenticated, navigate]);

  return (
    <div data-page="landing" className="bg-[#1a1a18] w-full min-h-screen overflow-x-hidden flex flex-col">
      <Helmet>
        <title>Chess99 — Play Chess Online | Free Multiplayer Chess Platform</title>
        <meta name="description" content="Play chess online for free on Chess99. Challenge players worldwide, solve tactical puzzles, learn with interactive tutorials, and compete in tournaments. India's premier chess platform." />
        <meta property="og:title" content="Chess99 — Play Chess Online" />
        <meta property="og:description" content="Free online chess platform with multiplayer games, puzzles, tutorials, and tournaments. Play now!" />
        <meta property="og:image" content="https://chess99.com/og-image.png" />
        <meta property="og:url" content="https://chess99.com/" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Chess99" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Chess99 — Play Chess Online" />
        <meta name="twitter:description" content="Free online chess platform with multiplayer games, puzzles, tutorials, and tournaments." />
        <meta name="twitter:image" content="https://chess99.com/og-image.png" />
        <link rel="canonical" href="https://chess99.com/" />
      </Helmet>
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
                  Login
                </button>
                <button
                  onClick={() => navigate('/login?mode=register')}
                  className="bg-[#312e2b] text-white px-4 py-1.5 rounded text-sm font-semibold hover:bg-[#3d3a37] transition-colors border border-[#4a4744]"
                >
                  Register
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
            {!isAuthenticated && (
              <button
                onClick={() => navigate('/login')}
                className="bg-[#312e2b] text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-[#3d3a37] transition-colors border border-[#4a4744]"
              >
                Login
              </button>
            )}
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
                    onClick={() => { navigate('/login?mode=register'); setShowMobileMenu(false); }}
                    className="text-left px-4 py-2.5 text-sm font-medium text-[#bababa] bg-transparent border-0 hover:text-white hover:bg-[#312e2b] rounded transition-colors"
                  >
                    Register
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

      {showPlayChoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-xl border border-[#3d3a37] bg-[#262421] p-5 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-2">Start Playing</h2>
            <p className="text-sm text-[#bababa] mb-5">
              Play a casual computer game now, or log in to use online matchmaking and save progress.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleGuestPlay}
                className="w-full rounded-lg bg-[#81b64c] px-4 py-3 text-sm font-bold text-white hover:bg-[#a3d160] transition-colors"
              >
                Play as Guest
              </button>
              <button
                onClick={handleLoginPlay}
                className="w-full rounded-lg border border-[#4a4744] bg-[#312e2b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3d3a37] transition-colors"
              >
                Login / Register
              </button>
              <button
                onClick={() => setShowPlayChoice(false)}
                className="w-full rounded-lg bg-transparent px-4 py-2 text-sm font-medium text-[#bababa] hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section - Animated onboarding first */}
      <main className="flex-grow pt-14 flex flex-col">
        <section className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center relative overflow-hidden border-b border-[#3d3a37]/50">
          {/* Background image with dark overlay */}
          <img
            src={chessPlayingKids}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-[0.12]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a18]/86 via-[#262421]/74 to-[#1a1a18]/94" />

          {/* Content */}
          <div className="relative z-10 w-full max-w-7xl mx-auto px-4 py-8 sm:py-10">
            <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] items-center gap-7 lg:gap-12">
              <div className="text-center lg:text-left max-w-2xl mx-auto lg:mx-0">
                <p className="text-[#e8a93e] text-xs sm:text-sm font-extrabold uppercase tracking-[0.18em] mb-3">
                  New to Chess99?
                </p>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-3 sm:mb-4 leading-tight">
                  Watch the journey,<br />
                  then <span className="text-[#81b64c]">start playing</span>
                </h1>
                <p className="text-[#d8d4cf] text-base sm:text-lg lg:text-xl mb-6 sm:mb-7 leading-relaxed">
                  See how login, profile setup, casual games, rated games, CCT,
                  Best Moves, Companion, Tactical Progression, Training Drills,
                  and Lessons fit together before you make your first move.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                  <button
                    onClick={handlePlayClick}
                    className="bg-[#81b64c] text-white px-8 py-3 rounded-lg text-lg font-bold hover:bg-[#a3d160] transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Play Now
                  </button>
                </div>

                <p className="text-[#bababa] text-sm mt-4">
                  Join <span className="text-[#81b64c] font-semibold">1,000+ players</span> with beginner-friendly 800 ELO starts, online matchmaking, and guided learning.
                </p>
              </div>

              <div className="w-full">
                <IntroVideo
                  variant="hero"
                  showCopy={false}
                  onLogin={() => navigate('/login')}
                  onPlay={handlePlayClick}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#1a1a18] border-t border-[#3d3a37]/50 py-10 sm:py-14 px-4">
          <PlayModeGuide
            groups={ONBOARDING_GUIDE_GROUPS}
            isAuthenticated={isAuthenticated}
            onAction={handleGuideAction}
          />
        </section>

        {/* Compact Feature Strip */}
        <section className="bg-[#1a1a18] border-t border-[#3d3a37]/50 py-8 sm:py-12">
          <div className="max-w-4xl mx-auto px-4">
            {/* Trust stats row */}
            <div className="flex justify-center gap-8 flex-wrap mb-6 sm:mb-8">
              <div className="text-center">
                <div className="text-xl font-bold text-white">1,000+</div>
                <div className="text-xs text-[#8b8987]">Active Players</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-[#81b64c]">50+</div>
                <div className="text-xs text-[#8b8987]">Countries</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-[#e8a93e]">10,000+</div>
                <div className="text-xs text-[#8b8987]">Games Played</div>
              </div>
            </div>
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
                    ₹{pricingInterval === 'monthly' ? '199' : '1,999'}
                  </div>
                  <div className="text-[#8b8987] text-sm mt-1">
                    {pricingInterval === 'monthly' ? 'per month' : 'per year · save ₹389'}
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
