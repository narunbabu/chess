// src/components/GameCompletionAnimation.js
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { saveGameHistory, storePendingGame } from "../services/gameHistoryService"; // Assuming this path is correct
import { updateRating } from "../services/ratingService";
import { getRatingFromLevel } from "../utils/eloUtils";
import { useAuth } from "../contexts/AuthContext";
import { isWin, isDraw as isDrawResult, getResultDisplayText } from "../utils/resultStandardization";
import { shareGameWithFriends } from "../utils/shareUtils";
import { encodeGameHistory } from "../utils/gameHistoryStringUtils"; // Import for encoding moves
import GIF from 'gif.js';
import GameEndCard from "./GameEndCard";
import "./GameCompletionAnimation.css";

// Note: Image utility functions have been moved to utils/imageUtils.js
// Share functionality has been moved to utils/shareUtils.js

const GameCompletionAnimation = ({
  result,
  score,
  opponentScore,
  playerColor,
  onClose,
  moves,
  gameHistory = [], // Full history array for pending construction
  onNewGame,
  onBackToLobby,
  onPreview,
  isMultiplayer = false,
  computerLevel = null, // Computer difficulty level (1-16)
  opponentRating = null, // For multiplayer games
  opponentId = null, // For multiplayer games
  gameId = null, // Game ID for history tracking
  championshipData = null, // Championship info: { tournamentName, round, matchId, standing, points }
  isPreview = false // Flag to indicate if this is preview mode
}) => {
  const [isVisible, setIsVisible] = useState(false); // Controls card visibility for animation
  // const [selectedColor, setSelectedColor] = useState('random'); // Color preference for new game challenge - UNUSED
  const [ratingUpdate, setRatingUpdate] = useState({
    isLoading: true,
    oldRating: null,
    newRating: null,
    ratingChange: null,
    error: null
  });
  const [hasProcessedRating, setHasProcessedRating] = useState(false);
  const [isTestSharing, setIsTestSharing] = useState(false); // Test Share state
  const { isAuthenticated, user, fetchUser } = useAuth();
  const navigate = useNavigate();
  const gameEndCardRef = useRef(null); // Ref for wrapper (used for layout)
  const gameEndCardContentRef = useRef(null); // Ref for actual GameEndCard component (used for sharing)

  // Determine win state for both single player and multiplayer
  const isPlayerWin = (() => {
    // For multiplayer games, use the isPlayerWin field if available
    if (isMultiplayer && typeof result?.isPlayerWin === 'boolean') {
      return result.isPlayerWin;
    }

    // For single player games, use the standardization utility
    return isWin(result);
  })();

  // Check if it's a draw
  const isDraw = isMultiplayer
    ? result?.isPlayerDraw || result?.result === '1/2-1/2'
    : isDrawResult(result);

  useEffect(() => {
    // Start fade-in animation shortly after component mounts
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100); // Short delay to allow mounting before transition

    // Optional: Add logic for closing the modal after a delay or via onClose prop
    // For example, automatically navigate away after 10 seconds if desired.

    return () => clearTimeout(timer);
  }, []); // Runs only once on mount

  // Handle rating update
  useEffect(() => {
    const handleRatingUpdate = async () => {
      // Only update rating if user is authenticated and we haven't processed yet
      if (!isAuthenticated || !user || hasProcessedRating) {
        if (hasProcessedRating) {
          setRatingUpdate(prev => ({ ...prev, isLoading: false }));
        }
        return;
      }

      try {
        // Determine game result
        const gameResult = isPlayerWin ? 'win' : (isDraw ? 'draw' : 'loss');

        // Prepare rating update payload
        let ratingData = {
          result: gameResult,
        };

        if (isMultiplayer) {
          // Multiplayer game rating update
          if (!opponentRating) {
            console.warn('Multiplayer game but no opponent rating provided');
            setRatingUpdate(prev => ({ ...prev, isLoading: false }));
            return;
          }
          ratingData = {
            ...ratingData,
            opponent_rating: opponentRating,
            game_type: 'multiplayer',
            opponent_id: opponentId,
            game_id: gameId,
          };
        } else {
          // Computer game rating update
          if (!computerLevel) {
            console.warn('Computer game but no computer level provided');
            setRatingUpdate(prev => ({ ...prev, isLoading: false }));
            return;
          }
          const computerRating = getRatingFromLevel(computerLevel);
          ratingData = {
            ...ratingData,
            opponent_rating: computerRating,
            game_type: 'computer',
            computer_level: computerLevel,
            game_id: gameId,
          };
        }

        // Call rating API
        console.log('🎯 Sending rating update:', ratingData);
        const response = await updateRating(ratingData);
        console.log('📊 Rating update response:', response);

        if (response.success) {
          setRatingUpdate({
            isLoading: false,
            oldRating: response.data.old_rating,
            newRating: response.data.new_rating,
            ratingChange: response.data.rating_change,
            error: null
          });

          // Mark as processed to prevent duplicate requests
          setHasProcessedRating(true);

          // Refresh user data to sync the updated rating across the app
          if (fetchUser) {
            await fetchUser();
            console.log('✅ User rating refreshed in AuthContext');
          }
        } else {
          throw new Error('Rating update failed');
        }
      } catch (error) {
        console.error('Failed to update rating:', error);
        setRatingUpdate({
          isLoading: false,
          oldRating: null,
          newRating: null,
          ratingChange: null,
          error: error.message || 'Failed to update rating'
        });
        setHasProcessedRating(true); // Mark as processed even on error to prevent retries
      }
    };

    handleRatingUpdate();
  }, [isAuthenticated, user, fetchUser, isPlayerWin, isDraw, isMultiplayer, computerLevel, opponentRating, opponentId, gameId, hasProcessedRating]);

  // UNUSED - Commented out to remove ESLint warning
  // const exportAsGIF = async () => {
  //   const canvas = document.createElement('canvas');
  //   // Setup canvas and capture frames here
  //
  //   const gif = new GIF({
  //     workerScript: process.env.PUBLIC_URL + '/gif.worker.js',
  //     quality: 10,
  //     width: canvas.width,
  //     height: canvas.height
  //   });
  //
  //   // Add frames to gif
  //   // gif.addFrame(...);
  //
  //   gif.on('finished', (blob) => {
  //     const link = document.createElement('a');
  //     link.download = 'chess-game.gif';
  //     link.href = URL.createObjectURL(blob);
  //     link.click();
  //   });
  //
  //   gif.render();
  // };

  const handleContinue = async () => {
    if (isAuthenticated) {
      try {
        await saveGameHistory({
          result,
          score,
          opponentScore,
          playerColor,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Failed to save game history:", error);
        // Optionally notify the user
      }
    }
    // Navigate regardless of save success/failure, or handle error differently
    navigate("/dashboard"); // Navigate to dashboard or another appropriate route
  };

  const handleLoginRedirect = () => {
    // Encode moves to semicolon-separated format for efficient storage
    let movesString;
    if (Array.isArray(gameHistory) && gameHistory.length > 0) {
      // Use encodeGameHistory to convert to semicolon format: e4,2.52;Nf6,0.98;...
      movesString = encodeGameHistory(gameHistory);
      console.log('[GameCompletionAnimation] ✅ Encoded gameHistory to semicolon format:', {
        history_length: gameHistory.length,
        encoded_sample: movesString.substring(0, 100),
        string_length: movesString.length
      });
    } else if (typeof moves === 'string' && moves) {
      movesString = moves;
      console.log('[GameCompletionAnimation] Using passed moves string:', moves.substring(0, 100));
    } else {
      movesString = ''; // Use empty string for no moves
      console.warn('[GameCompletionAnimation] No moves available for pending game, using empty string');
    }

    // Store the game data locally before redirecting to login
    const gameDataToStore = {
      result,
      score,
      opponentScore,
      playerColor,
      timestamp: new Date().toISOString(),
      computerLevel,
      moves: movesString, // Detailed JSON string
      gameId,
      opponentRating,
      opponentId,
      championshipData,
      isMultiplayer
    };

    storePendingGame(gameDataToStore);
    console.log('[GameCompletionAnimation] Game data stored for deferred save before login redirect');

    navigate("/login");
  };
  const handleViewInHistory = () => {
    const savedGameId = localStorage.getItem('lastGameId');
    if (savedGameId) {
      navigate("/history", { state: { gameIdToSelect: savedGameId } });
    } else {
      navigate("/history"); // Fallback if no game ID found
    }
    onClose?.(); // Close the animation
  };

  const handlePlayAgain = () => {
    onClose?.(); // Close the animation
    navigate("/play"); // Ensure '/play' route exists
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 🎉 Share with Friends - Unified share functionality for all game types
  const handleShareWithFriends = async () => {
    const cardElement = gameEndCardContentRef.current;

    // Determine game type
    let gameType = 'computer';
    if (championshipData) {
      gameType = 'championship';
    } else if (isMultiplayer) {
      gameType = 'multiplayer';
    }

    // Prepare game data
    const opponentName = isMultiplayer
      ? (playerColor === 'w' ? result?.black_player?.name : result?.white_player?.name)
      : (championshipData
          ? (playerColor === 'w' ? result?.black_player?.name : result?.white_player?.name)
          : 'Computer');

    const gameData = {
      gameId,
      userId: user?.id,
      userName: user?.name || 'Player',
      isWin: isPlayerWin,
      isDraw,
      opponentName,
      result,
      gameType,
      championshipData // Will be null for regular games
    };

    // Call unified share function
    await shareGameWithFriends({
      cardElement,
      gameData,
      setIsSharing: setIsTestSharing
    });
  };

  const overlayClass = `completion-overlay ${isDraw ? "draw" : (isPlayerWin ? "win" : "loss")} ${
    isVisible ? "visible" : ""
  }`;
  // UNUSED - Commented out to remove ESLint warnings
  // const cardClass = `completion-card ${isVisible ? "visible" : ""}`;
  // const icon = isDraw ? "🤝" : (isPlayerWin ? "🏆" : "💔"); // Handshake for draw, Trophy for win, Broken Heart for loss
  // const title = isDraw ? "Draw!" : (isPlayerWin ? "Victory!" : "Defeat"); // Handle all three cases

  return (
    <div className={overlayClass}>
      {/* Main GameEndCard - now visible and centered with extra bottom padding for action buttons */}
      <div ref={gameEndCardRef} style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        minHeight: '100vh',
        height: '100vh',
        padding: window.innerWidth <= 480 ? '10px' : '20px',
        paddingTop: window.innerWidth <= 480 ? '50px' : '80px', // Extra top padding for close button
        paddingBottom: window.innerWidth <= 480 ? '120px' : '140px', // Extra bottom padding for action buttons and share button
        overflowY: 'auto', // Allow scrolling
        overflowX: 'hidden', // Prevent horizontal scroll
        WebkitOverflowScrolling: 'touch' // Smooth scrolling on iOS
      }}>
        <GameEndCard
          ref={gameEndCardContentRef}
          result={result}
          user={user}
          ratingUpdate={ratingUpdate}
          score={score}
          opponentScore={opponentScore}
          playerColor={playerColor}
          isMultiplayer={isMultiplayer}
          computerLevel={computerLevel}
          isAuthenticated={isAuthenticated}
          championshipData={championshipData}
          className={`${isVisible ? "visible" : ""}`}
        />
      </div>

      {/* Optional: Close button if onClose prop is provided */}
      {onClose && (
        <button
          onClick={onClose}
          className="close-button"
          aria-label="Close"
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: 'rgba(255, 255, 255, 0.95)',
            border: 'none',
            borderRadius: '50%',
            width: '45px',
            height: '45px',
            fontSize: '28px',
            cursor: 'pointer',
            zIndex: 10000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#333',
            fontWeight: 'bold'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 1)';
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
          }}
        >
          &times;
        </button>
      )}

      {/* Action buttons container - positioned at top for single player */}
      {!isMultiplayer && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          justifyContent: 'center',
          zIndex: 1000,
          maxWidth: '90%'
        }}>
          {isAuthenticated ? (
            <>
              <button onClick={handleContinue} className="btn btn-primary">
                Continue to Dashboard
              </button>
              <button onClick={handleViewInHistory} className="btn btn-secondary">
                View in History
              </button>
              <button onClick={handlePlayAgain} className="btn btn-secondary">
                Play Again
              </button>
            </>
          ) : (
            <>
              <button onClick={handleLoginRedirect} className="btn btn-primary">
                Login to Save
              </button>
              <button onClick={handlePlayAgain} className="btn btn-secondary">
                Play Again
              </button>
            </>
          )}
        </div>
      )}

      {/* Multiplayer action buttons */}
      {isMultiplayer && (
        <div style={{
          position: 'fixed',
          bottom: window.innerWidth <= 480 ? '12px' : '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: window.innerWidth <= 480 ? '6px' : '10px',
          flexWrap: 'wrap',
          justifyContent: 'center',
          zIndex: 1000,
          maxWidth: '95%'
        }}>
          {/* Prominent Share button with bright green color */}
          {/* <button
            onClick={handleShareWithImage}
            style={{
              backgroundColor: '#10B981',
              color: 'white',
              padding: window.innerWidth <= 480 ? '9px 16px' : '12px 24px',
              borderRadius: '10px',
              border: 'none',
              fontSize: window.innerWidth <= 480 ? '0.85rem' : '1rem',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: window.innerWidth <= 480 ? '6px' : '8px',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
              transform: window.innerWidth <= 480 ? 'scale(1.02)' : 'scale(1.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#059669';
              e.currentTarget.style.transform = 'scale(1.1) translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#10B981';
              e.currentTarget.style.transform = 'scale(1.05) translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
            }}
          >
            <svg
              style={{ width: window.innerWidth <= 480 ? '16px' : '20px', height: window.innerWidth <= 480 ? '16px' : '20px' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            Share Game Result
          </button> */}
          {/* 🎉 Share with Friends button - prominent and attractive */}
          <button
            onClick={handleShareWithFriends}
            disabled={isTestSharing}
            style={{
              backgroundColor: isTestSharing ? '#6B7280' : '#EC4899',
              color: 'white',
              padding: window.innerWidth <= 480 ? '12px 20px' : '16px 32px',
              borderRadius: '12px',
              border: 'none',
              fontSize: window.innerWidth <= 480 ? '1rem' : '1.15rem',
              fontWeight: '800',
              cursor: isTestSharing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: window.innerWidth <= 480 ? '8px' : '10px',
              boxShadow: '0 6px 20px rgba(236, 72, 153, 0.5)',
              opacity: isTestSharing ? 0.6 : 1,
              transform: 'scale(1.08)'
            }}
            onMouseEnter={(e) => {
              if (!isTestSharing) {
                e.currentTarget.style.backgroundColor = '#DB2777';
                e.currentTarget.style.transform = 'scale(1.12) translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(236, 72, 153, 0.6)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isTestSharing) {
                e.currentTarget.style.backgroundColor = '#EC4899';
                e.currentTarget.style.transform = 'scale(1.08) translateY(0)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(236, 72, 153, 0.5)';
              }
            }}
          >
            {isTestSharing ? (
              <>
                <svg
                  className="animate-spin"
                  style={{ width: window.innerWidth <= 480 ? '18px' : '22px', height: window.innerWidth <= 480 ? '18px' : '22px' }}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Creating Link...</span>
              </>
            ) : (
              <>
                <svg
                  style={{ width: window.innerWidth <= 480 ? '18px' : '22px', height: window.innerWidth <= 480 ? '18px' : '22px' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
                🎉 Share with Friends
              </>
            )}
          </button>
          {onNewGame && (
            <button
              onClick={() => onNewGame('random')}
              style={{
                backgroundColor: '#6B7280',
                color: 'white',
                padding: window.innerWidth <= 480 ? '6px 10px' : '8px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: window.innerWidth <= 480 ? '0.7rem' : '0.8rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 1px 4px rgba(107, 114, 128, 0.2)',
                opacity: 0.9
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#4B5563';
                e.currentTarget.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#6B7280';
                e.currentTarget.style.opacity = '0.9';
              }}
            >
              <span style={{ fontSize: '0.9rem' }}>🎮</span>
              New Game
            </button>
          )}
          {onPreview && (
            <button
              onClick={onPreview}
              style={{
                backgroundColor: '#6B7280',
                color: 'white',
                padding: window.innerWidth <= 480 ? '6px 10px' : '8px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: window.innerWidth <= 480 ? '0.7rem' : '0.8rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 1px 4px rgba(107, 114, 128, 0.2)',
                opacity: 0.9
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#4B5563';
                e.currentTarget.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#6B7280';
                e.currentTarget.style.opacity = '0.9';
              }}
            >
              <span style={{ fontSize: '0.9rem' }}>👁️</span>
              Preview
            </button>
          )}

          {onBackToLobby && (
            <button
              onClick={onBackToLobby}
              style={{
                backgroundColor: '#6B7280',
                color: 'white',
                padding: window.innerWidth <= 480 ? '6px 10px' : '8px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: window.innerWidth <= 480 ? '0.7rem' : '0.8rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 1px 4px rgba(107, 114, 128, 0.2)',
                opacity: 0.9
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#4B5563';
                e.currentTarget.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#6B7280';
                e.currentTarget.style.opacity = '0.9';
              }}
            >
              <span style={{ fontSize: '0.9rem' }}>🏠</span>
              Lobby
            </button>
          )}

          {championshipData && championshipData.championshipId && (
            <button
              onClick={() => navigate(`/championships/${championshipData.championshipId}`)}
              style={{
                backgroundColor: '#8B5CF6',
                color: 'white',
                padding: window.innerWidth <= 480 ? '6px 10px' : '8px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: window.innerWidth <= 480 ? '0.7rem' : '0.8rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 1px 4px rgba(139, 92, 246, 0.2)',
                opacity: 0.9
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#7C3AED';
                e.currentTarget.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#8B5CF6';
                e.currentTarget.style.opacity = '0.9';
              }}
            >
              <span style={{ fontSize: '0.9rem' }}>🏆</span>
              Championship
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default GameCompletionAnimation;
