/**
 * Integration Tests for PlayMultiplayer Refactored Hooks
 *
 * These tests verify that the extracted hooks work correctly together
 * and maintain the same behavior as the original monolithic component.
 *
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import { Chess } from 'chess.js';
import { useGameState } from '../../components/play/hooks/useGameState';
import { usePauseResume } from '../../components/play/hooks/usePauseResume';
import { useWebSocketEvents } from '../../components/play/hooks/useWebSocketEvents';
import { useMoveValidation } from '../../components/play/hooks/useMoveValidation';

describe('PlayMultiplayer Hooks Integration Tests', () => {
  describe('useGameState', () => {
    it('should initialize with default game state', () => {
      const { result } = renderHook(() => useGameState({ user: { id: '1' } }));

      expect(result.current.game).toBeInstanceOf(Chess);
      expect(result.current.gameInfo.status).toBe('active');
      expect(result.current.loading).toBe(true);
      expect(result.current.gameComplete).toBe(false);
    });

    it('should derive myColor correctly from gameData', () => {
      const user = { id: '1' };
      const { result, rerender } = renderHook(() => useGameState({ user }));

      // Initially no color
      expect(result.current.myColor).toBeNull();

      // Set game data with user as white player
      act(() => {
        result.current.setGameData({
          white_player_id: '1',
          black_player_id: '2',
        });
      });

      // Should now derive color as 'w'
      expect(result.current.myColor).toBe('w');

      // Change to black player
      act(() => {
        result.current.setGameData({
          white_player_id: '2',
          black_player_id: '1',
        });
      });

      expect(result.current.myColor).toBe('b');
    });

    it('should determine isMyTurn correctly', () => {
      const user = { id: '1' };
      const { result } = renderHook(() => useGameState({ user }));

      // Set up game data and turn
      act(() => {
        result.current.setGameData({
          white_player_id: '1',
          black_player_id: '2',
        });
        result.current.setGameInfo({
          ...result.current.gameInfo,
          turn: 'white',
        });
      });

      // Should be player's turn (white player, white's turn)
      expect(result.current.isMyTurn).toBe(true);

      // Change turn to black
      act(() => {
        result.current.setGameInfo({
          ...result.current.gameInfo,
          turn: 'black',
        });
      });

      // Should no longer be player's turn
      expect(result.current.isMyTurn).toBe(false);
    });

    it('should update game info with partial updates', () => {
      const { result } = renderHook(() => useGameState({ user: { id: '1' } }));

      act(() => {
        result.current.updateGameInfo({
          status: 'paused',
          opponentName: 'Test Opponent',
        });
      });

      expect(result.current.gameInfo.status).toBe('paused');
      expect(result.current.gameInfo.opponentName).toBe('Test Opponent');
      expect(result.current.gameInfo.turn).toBe('white'); // Other fields preserved
    });

    it('should reset game state completely', () => {
      const { result } = renderHook(() => useGameState({ user: { id: '1' } }));

      // Modify some state
      act(() => {
        result.current.setGameComplete(true);
        result.current.setPlayerScore(100);
        result.current.setOpponentScore(50);
        result.current.setGameHistory(['e4', 'e5']);
      });

      // Reset
      act(() => {
        result.current.resetGameState();
      });

      expect(result.current.gameComplete).toBe(false);
      expect(result.current.playerScore).toBe(0);
      expect(result.current.opponentScore).toBe(0);
      expect(result.current.gameHistory).toEqual([]);
    });
  });

  describe('usePauseResume', () => {
    it('should initialize with default pause/resume state', () => {
      const { result } = renderHook(() => usePauseResume());

      expect(result.current.showPresenceDialog).toBe(false);
      expect(result.current.showPausedGame).toBe(false);
      expect(result.current.isWaitingForResumeResponse).toBe(false);
      expect(result.current.resumeRequestCountdown).toBe(0);
    });

    it('should update activity timestamp', () => {
      const { result } = renderHook(() => usePauseResume());

      const beforeTime = result.current.lastActivityTimeRef.current;

      // Wait a bit
      jest.advanceTimersByTime(100);

      act(() => {
        result.current.updateActivity();
      });

      const afterTime = result.current.lastActivityTimeRef.current;
      expect(afterTime).toBeGreaterThan(beforeTime);
    });

    it('should handle game paused event', () => {
      const { result } = renderHook(() => usePauseResume());

      act(() => {
        result.current.handlePaused('Opponent Name');
      });

      expect(result.current.showPausedGame).toBe(true);
      expect(result.current.pausedByUserName).toBe('Opponent Name');
      expect(result.current.showPresenceDialog).toBe(false);
    });

    it('should handle game resumed event', () => {
      const { result } = renderHook(() => usePauseResume());

      // First pause
      act(() => {
        result.current.handlePaused('Opponent');
      });

      expect(result.current.showPausedGame).toBe(true);

      // Then resume
      act(() => {
        result.current.handleResumed();
      });

      expect(result.current.showPausedGame).toBe(false);
      expect(result.current.pausedByUserName).toBeNull();
      expect(result.current.resumeRequestData).toBeNull();
    });

    it('should manage countdown timer', () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => usePauseResume());

      act(() => {
        result.current.startResumeCountdown(10);
      });

      expect(result.current.resumeRequestCountdown).toBe(10);

      // Advance by 3 seconds
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(result.current.resumeRequestCountdown).toBe(7);

      // Advance to completion
      act(() => {
        jest.advanceTimersByTime(7000);
      });

      expect(result.current.resumeRequestCountdown).toBe(0);
      expect(result.current.resumeRequestData).toBeNull();

      jest.useRealTimers();
    });

    it('should check cooldown state', () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => usePauseResume());

      // Set recent resume request time
      const now = Date.now();
      act(() => {
        result.current.setLastManualResumeRequestTime(now);
      });

      expect(result.current.isCooldownActive()).toBe(true);
      expect(result.current.getRemainingCooldown()).toBe(60);

      // Advance 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      expect(result.current.isCooldownActive()).toBe(true);
      expect(result.current.getRemainingCooldown()).toBeLessThanOrEqual(30);

      // Advance past cooldown
      act(() => {
        jest.advanceTimersByTime(35000);
      });

      expect(result.current.isCooldownActive()).toBe(false);
      expect(result.current.getRemainingCooldown()).toBe(0);

      jest.useRealTimers();
    });
  });

  describe('useWebSocketEvents', () => {
    let mockWsService;
    let mockUser;

    beforeEach(() => {
      mockWsService = {
        current: {
          on: jest.fn(),
          subscribeToUserChannel: jest.fn(() => ({
            listen: jest.fn(),
          })),
          isWebSocketConnected: jest.fn(() => true),
          isConnected: true,
        },
      };

      mockUser = { id: '1', name: 'Test User' };
    });

    it('should setup all WebSocket event listeners', () => {
      const { result } = renderHook(() =>
        useWebSocketEvents({
          wsService: mockWsService,
          user: mockUser,
          setConnectionStatus: jest.fn(),
          setNewGameRequest: jest.fn(),
        })
      );

      const handlers = {
        onRemoteMove: jest.fn(),
        onGameStatusChange: jest.fn(),
        onGameEnd: jest.fn(),
        onGameActivated: jest.fn(),
        onGameResumed: jest.fn(),
        onGamePaused: jest.fn(),
        onOpponentPing: jest.fn(),
        onUndoRequest: jest.fn(),
        onUndoAccepted: jest.fn(),
        onUndoDeclined: jest.fn(),
        onPlayerConnection: jest.fn(),
        onDrawOfferReceived: jest.fn(),
        onDrawOfferDeclined: jest.fn(),
        onError: jest.fn(),
      };

      act(() => {
        result.current.setupWebSocketListeners(handlers);
      });

      // Verify all main events are registered
      expect(mockWsService.current.on).toHaveBeenCalledWith('connected', expect.any(Function));
      expect(mockWsService.current.on).toHaveBeenCalledWith('disconnected', expect.any(Function));
      expect(mockWsService.current.on).toHaveBeenCalledWith('gameMove', expect.any(Function));
      expect(mockWsService.current.on).toHaveBeenCalledWith('gameEnded', expect.any(Function));
      expect(mockWsService.current.on).toHaveBeenCalledWith('gameResumed', expect.any(Function));
      expect(mockWsService.current.on).toHaveBeenCalledWith('gamePaused', expect.any(Function));

      // Verify user channel is subscribed
      expect(mockWsService.current.subscribeToUserChannel).toHaveBeenCalledWith(mockUser);
    });

    it('should check WebSocket connection status', () => {
      const { result } = renderHook(() =>
        useWebSocketEvents({
          wsService: mockWsService,
          user: mockUser,
          setConnectionStatus: jest.fn(),
          setNewGameRequest: jest.fn(),
        })
      );

      expect(result.current.isWebSocketConnected()).toBe(true);

      // Test with disconnected state
      mockWsService.current.isWebSocketConnected = jest.fn(() => false);
      mockWsService.current.isConnected = false;

      expect(result.current.isWebSocketConnected()).toBe(false);
    });
  });

  describe('useMoveValidation', () => {
    let mockGame;
    let mockGameInfo;
    let mockWsService;

    beforeEach(() => {
      mockGame = new Chess();
      mockGameInfo = {
        status: 'active',
        turn: 'white',
        playerColor: 'white',
      };
      mockWsService = {
        current: {
          isWebSocketConnected: jest.fn(() => true),
        },
      };
    });

    it('should validate a legal move', () => {
      const { result } = renderHook(() =>
        useMoveValidation({
          game: mockGame,
          gameInfo: mockGameInfo,
          gameComplete: false,
          connectionStatus: 'connected',
          wsService: mockWsService,
          findKingSquare: jest.fn(),
          setErrorMessage: jest.fn(),
          setShowError: jest.fn(),
          setKingInDangerSquare: jest.fn(),
        })
      );

      const validation = result.current.validateMove('e2', 'e4');

      expect(validation.valid).toBe(true);
      expect(validation.move).toBeTruthy();
      expect(validation.move.san).toBe('e4');
    });

    it('should reject move when game is not active', () => {
      const { result } = renderHook(() =>
        useMoveValidation({
          game: mockGame,
          gameInfo: { ...mockGameInfo, status: 'paused' },
          gameComplete: false,
          connectionStatus: 'connected',
          wsService: mockWsService,
          findKingSquare: jest.fn(),
          setErrorMessage: jest.fn(),
          setShowError: jest.fn(),
          setKingInDangerSquare: jest.fn(),
        })
      );

      const validation = result.current.validateMove('e2', 'e4');

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('Game is paused');
    });

    it('should reject move when not player turn', () => {
      const { result } = renderHook(() =>
        useMoveValidation({
          game: mockGame,
          gameInfo: { ...mockGameInfo, turn: 'black' },
          gameComplete: false,
          connectionStatus: 'connected',
          wsService: mockWsService,
          findKingSquare: jest.fn(),
          setErrorMessage: jest.fn(),
          setShowError: jest.fn(),
          setKingInDangerSquare: jest.fn(),
        })
      );

      const validation = result.current.validateMove('e2', 'e4');

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('Not your turn');
    });

    it('should reject invalid chess move', () => {
      const { result } = renderHook(() =>
        useMoveValidation({
          game: mockGame,
          gameInfo: mockGameInfo,
          gameComplete: false,
          connectionStatus: 'connected',
          wsService: mockWsService,
          findKingSquare: jest.fn(),
          setErrorMessage: jest.fn(),
          setShowError: jest.fn(),
          setKingInDangerSquare: jest.fn(),
        })
      );

      const validation = result.current.validateMove('e2', 'e5'); // Invalid move

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('Invalid');
    });

    it('should check if move is legal', () => {
      const { result } = renderHook(() =>
        useMoveValidation({
          game: mockGame,
          gameInfo: mockGameInfo,
          gameComplete: false,
          connectionStatus: 'connected',
          wsService: mockWsService,
          findKingSquare: jest.fn(),
          setErrorMessage: jest.fn(),
          setShowError: jest.fn(),
          setKingInDangerSquare: jest.fn(),
        })
      );

      expect(result.current.isMoveLegal('e2', 'e4')).toBe(true);
      expect(result.current.isMoveLegal('e2', 'e5')).toBe(false);
    });

    it('should get available moves for a piece', () => {
      const { result } = renderHook(() =>
        useMoveValidation({
          game: mockGame,
          gameInfo: mockGameInfo,
          gameComplete: false,
          connectionStatus: 'connected',
          wsService: mockWsService,
          findKingSquare: jest.fn(),
          setErrorMessage: jest.fn(),
          setShowError: jest.fn(),
          setKingInDangerSquare: jest.fn(),
        })
      );

      const moves = result.current.getAvailableMoves('e2');

      expect(moves).toBeInstanceOf(Array);
      expect(moves.length).toBeGreaterThan(0);
      expect(moves.some(m => m.to === 'e4')).toBe(true);
    });
  });

  describe('Hooks Integration', () => {
    it('should work together for a complete move flow', () => {
      const user = { id: '1' };

      // Setup game state
      const gameState = renderHook(() => useGameState({ user })).result;

      act(() => {
        gameState.current.setGameData({
          white_player_id: '1',
          black_player_id: '2',
        });
        gameState.current.updateGameInfo({
          status: 'active',
          turn: 'white',
          playerColor: 'white',
        });
      });

      // Setup move validation
      const mockWsService = {
        current: {
          isWebSocketConnected: jest.fn(() => true),
        },
      };

      const moveValidation = renderHook(() =>
        useMoveValidation({
          game: gameState.current.game,
          gameInfo: gameState.current.gameInfo,
          gameComplete: gameState.current.gameComplete,
          connectionStatus: 'connected',
          wsService: mockWsService,
          findKingSquare: jest.fn(),
          setErrorMessage: jest.fn(),
          setShowError: jest.fn(),
          setKingInDangerSquare: jest.fn(),
        })
      ).result;

      // Validate and make a move
      const validation = moveValidation.current.validateMove('e2', 'e4');

      expect(validation.valid).toBe(true);
      expect(gameState.current.isMyTurn).toBe(true);
    });

    it('should handle pause/resume flow with game state', () => {
      const user = { id: '1' };

      const gameState = renderHook(() => useGameState({ user })).result;
      const pauseResume = renderHook(() => usePauseResume()).result;

      // Game is initially active
      act(() => {
        gameState.current.updateGameInfo({ status: 'active' });
      });

      expect(gameState.current.gameInfo.status).toBe('active');

      // Pause the game
      act(() => {
        pauseResume.current.handlePaused('Opponent');
        gameState.current.updateGameInfo({ status: 'paused' });
      });

      expect(gameState.current.gameInfo.status).toBe('paused');
      expect(pauseResume.current.showPausedGame).toBe(true);

      // Resume the game
      act(() => {
        pauseResume.current.handleResumed();
        gameState.current.updateGameInfo({ status: 'active' });
      });

      expect(gameState.current.gameInfo.status).toBe('active');
      expect(pauseResume.current.showPausedGame).toBe(false);
    });
  });
});
