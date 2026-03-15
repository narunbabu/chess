// src/contexts/GameNavigationContext.js
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const GameNavigationContext = createContext(null);

export const GameNavigationProvider = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // State for tracking active game
  const [activeGame, setActiveGame] = useState(null);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [isRatedGame, setIsRatedGame] = useState(false);

  // Refs to track current game state
  const gameActiveRef = useRef(false);
  const gamePausedRef = useRef(false);
  const gameIdRef = useRef(null);
  const lastValidLocationRef = useRef(location.pathname);

  // Track whether we've pushed a guard entry into history
  const historyGuardPushedRef = useRef(false);

  // Prevent accidental navigation away from active games
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (gameActiveRef.current && !gamePausedRef.current) {
        e.preventDefault();
        e.returnValue = 'You have an active chess game in progress. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    // popstate fires AFTER the browser has already navigated back.
    // e.preventDefault() does NOT work on popstate events.
    // Instead, we push an extra history entry when a game is active,
    // so pressing "back" consumes it and stays on the same page.
    const handlePopState = () => {
      if (gameActiveRef.current && !gamePausedRef.current) {
        console.log('[GameNavigation] Browser back during active game — blocking');
        // Re-push guard entry so the next back press is also caught
        window.history.pushState({ gameGuard: true }, '', location.pathname);
        historyGuardPushedRef.current = true;
        setShowWarningDialog(true);
        // Browser back doesn't tell us the target — default to dashboard
        setPendingNavigation('/');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [location.pathname]);

  // Register an active game
  const registerActiveGame = useCallback((gameId, gameState = 'active', isRated = false) => {
    console.log('[GameNavigation] Registering active game:', gameId, 'state:', gameState, 'isRated:', isRated);
    gameIdRef.current = gameId;
    gameActiveRef.current = true;
    gamePausedRef.current = gameState === 'paused';
    setIsRatedGame(isRated);

    setActiveGame({
      id: gameId,
      isActive: true,
      isPaused: gameState === 'paused',
      state: gameState,
      isRated: isRated
    });

    // Push a guard history entry so browser back doesn't leave the page
    if (gameState !== 'paused' && !historyGuardPushedRef.current) {
      window.history.pushState({ gameGuard: true }, '', window.location.pathname);
      historyGuardPushedRef.current = true;
      console.log('[GameNavigation] Pushed history guard entry');
    }
  }, []);

  // Unregister game when leaving
  const unregisterActiveGame = useCallback(() => {
    console.log('[GameNavigation] Unregistering active game');
    gameIdRef.current = null;
    gameActiveRef.current = false;
    gamePausedRef.current = false;
    setIsRatedGame(false);
    setActiveGame(null);
    historyGuardPushedRef.current = false;
  }, []);

  // Update game state (e.g., when paused/resumed)
  const updateGameState = useCallback((gameState) => {
    console.log('[GameNavigation] Updating game state:', gameState);
    gamePausedRef.current = gameState === 'paused';

    setActiveGame(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        isPaused: gameState === 'paused',
        state: gameState
      };
    });
  }, []); // Remove activeGame dependency to prevent infinite loop

  // Check if current page is a game page (exclude review pages)
  const isGamePage = useCallback(() => {
    if (location.pathname.startsWith('/play/review/')) return false;
    return location.pathname.startsWith('/play/multiplayer/') ||
           location.pathname.startsWith('/play/');
  }, [location.pathname]);

  // Handle navigation attempt
  const handleNavigationAttempt = useCallback((targetPath) => {
    // If not in an active game, allow navigation
    if (!gameActiveRef.current || !gameIdRef.current) {
      console.log('[GameNavigation] No active game, allowing navigation to:', targetPath);
      return true;
    }

    // Allow navigation to essential game-related pages (resign, pause, etc.)
    const allowedPaths = [
      '/play/multiplayer/',
      '/play/',
      '/profile'
    ];

    const isAllowedPath = allowedPaths.some(path => targetPath.startsWith(path));

    if (isAllowedPath) {
      console.log('[GameNavigation] Navigation to allowed path:', targetPath);
      return true;
    }

    // For rated games, BLOCK navigation and show forfeit warning
    // Rated games cannot be paused, only forfeited
    if (isRatedGame && !gamePausedRef.current) {
      console.log('[GameNavigation] 🚫 BLOCKING navigation from rated game - forfeit required');
      setShowWarningDialog(true);
      setPendingNavigation(targetPath);
      return false;
    }

    // For casual games, show warning dialog
    console.log('[GameNavigation] Active casual game detected, showing navigation warning for:', targetPath);
    setShowWarningDialog(true);
    setPendingNavigation(targetPath);
    return false;
  }, [isRatedGame]);

  // Navigate with game guard
  const navigateWithGuard = useCallback((targetPath, options = {}) => {
    const canNavigate = handleNavigationAttempt(targetPath);

    if (canNavigate) {
      navigate(targetPath, options);
      return true;
    }

    return false;
  }, [navigate, handleNavigationAttempt]);

  // Pause game and allow navigation (for casual games)
  const pauseGameAndNavigate = useCallback(() => {
    if (pendingNavigation && gameIdRef.current) {
      console.log('[GameNavigation] Pausing game and navigating to:', pendingNavigation);

      // Trigger game pause via WebSocket or API call
      // This would integrate with the existing pause functionality in PlayMultiplayer
      const pauseEvent = new CustomEvent('requestGamePause', {
        detail: {
          gameId: gameIdRef.current,
          targetPath: pendingNavigation
        }
      });
      window.dispatchEvent(pauseEvent);

      setShowWarningDialog(false);
      setPendingNavigation(null);
    }
  }, [pendingNavigation]);

  // Forfeit rated game and allow navigation (for rated games)
  const forfeitGameAndNavigate = useCallback(() => {
    if (pendingNavigation && gameIdRef.current) {
      console.log('[GameNavigation] 🏳️ Forfeiting rated game and navigating to:', pendingNavigation);

      // Trigger game forfeit via custom event
      // PlayMultiplayer will handle the actual resignation
      const forfeitEvent = new CustomEvent('requestGameForfeit', {
        detail: {
          gameId: gameIdRef.current,
          targetPath: pendingNavigation
        }
      });
      window.dispatchEvent(forfeitEvent);

      setShowWarningDialog(false);
      setPendingNavigation(null);
    }
  }, [pendingNavigation]);

  // Cancel navigation
  const cancelNavigation = useCallback(() => {
    setShowWarningDialog(false);
    setPendingNavigation(null);
  }, []);

  const value = {
    activeGame,
    showWarningDialog,
    pendingNavigation,
    isRatedGame,
    registerActiveGame,
    unregisterActiveGame,
    updateGameState,
    navigateWithGuard,
    handleNavigationAttempt,
    pauseGameAndNavigate,
    forfeitGameAndNavigate,
    cancelNavigation,
    isGamePage
  };

  return (
    <GameNavigationContext.Provider value={value}>
      {children}
    </GameNavigationContext.Provider>
  );
};

export const useGameNavigation = () => {
  const context = useContext(GameNavigationContext);
  if (!context) {
    throw new Error('useGameNavigation must be used within GameNavigationProvider');
  }
  return context;
};