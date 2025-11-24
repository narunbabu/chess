// src/contexts/GameNavigationContext.js
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const GameNavigationContext = createContext(null);

export const GameNavigationProvider = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // State for tracking active game
  const [activeGame, setActiveGame] = useState(null);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  // Refs to track current game state
  const gameActiveRef = useRef(false);
  const gamePausedRef = useRef(false);
  const gameIdRef = useRef(null);

  // Register an active game
  const registerActiveGame = useCallback((gameId, gameState = 'active') => {
    console.log('[GameNavigation] Registering active game:', gameId, 'state:', gameState);
    gameIdRef.current = gameId;
    gameActiveRef.current = true;
    gamePausedRef.current = gameState === 'paused';

    setActiveGame({
      id: gameId,
      isActive: true,
      isPaused: gameState === 'paused',
      state: gameState
    });
  }, []);

  // Unregister game when leaving
  const unregisterActiveGame = useCallback(() => {
    console.log('[GameNavigation] Unregistering active game');
    gameIdRef.current = null;
    gameActiveRef.current = false;
    gamePausedRef.current = false;
    setActiveGame(null);
  }, []);

  // Update game state (e.g., when paused/resumed)
  const updateGameState = useCallback((gameState) => {
    console.log('[GameNavigation] Updating game state:', gameState);
    gamePausedRef.current = gameState === 'paused';

    if (activeGame) {
      setActiveGame(prev => ({
        ...prev,
        isPaused: gameState === 'paused',
        state: gameState
      }));
    }
  }, [activeGame]);

  // Check if current page is a game page
  const isGamePage = useCallback(() => {
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

    // If game is paused, allow navigation
    if (gamePausedRef.current) {
      console.log('[GameNavigation] Game is paused, allowing navigation to:', targetPath);
      return true;
    }

    // If trying to navigate to another game page, allow (same game or different game)
    if (targetPath.startsWith('/play/multiplayer/') || targetPath.startsWith('/play/')) {
      console.log('[GameNavigation] Navigating to game page, allowing');
      return true;
    }

    // If game is active and trying to go to non-game page, show warning
    console.log('[GameNavigation] Active game detected, showing navigation warning');
    setShowWarningDialog(true);
    setPendingNavigation(targetPath);
    return false;
  }, []);

  // Navigate with game guard
  const navigateWithGuard = useCallback((targetPath, options = {}) => {
    const canNavigate = handleNavigationAttempt(targetPath);

    if (canNavigate) {
      navigate(targetPath, options);
      return true;
    }

    return false;
  }, [navigate, handleNavigationAttempt]);

  // Pause game and allow navigation
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

  // Cancel navigation
  const cancelNavigation = useCallback(() => {
    setShowWarningDialog(false);
    setPendingNavigation(null);
  }, []);

  const value = {
    activeGame,
    showWarningDialog,
    pendingNavigation,
    registerActiveGame,
    unregisterActiveGame,
    updateGameState,
    navigateWithGuard,
    handleNavigationAttempt,
    pauseGameAndNavigate,
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