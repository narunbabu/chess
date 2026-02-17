// src/components/GameCompletionAnimation.js
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { saveGameHistory, storePendingGame } from "../services/gameHistoryService"; // Assuming this path is correct
import { updateRating } from "../services/ratingService";
import { getRatingFromLevel } from "../utils/eloUtils";
import { useAuth } from "../contexts/AuthContext";
import { isWin, isDraw as isDrawResult, getResultDisplayText } from "../utils/resultStandardization";
import { shareGameWithFriends, shareGameReplay } from "../utils/shareUtils";
import { encodeGameHistory } from "../utils/gameHistoryStringUtils"; // Import for encoding moves
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
  const [isGeneratingGif, setIsGeneratingGif] = useState(false); // GIF generation state
  const [gifProgress, setGifProgress] = useState(0); // GIF progress 0-100
  const { isAuthenticated, user, fetchUser } = useAuth();
  const navigate = useNavigate();
  const gameEndCardRef = useRef(null); // Ref for wrapper (used for layout)
  const gameEndCardContentRef = useRef(null); // Ref for actual GameEndCard component (used for sharing)
  const fetchUserCalledRef = useRef(false); // Track if fetchUser has been called to prevent re-render loop

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
          // Use synthetic player's actual rating when available (from result object),
          // otherwise fall back to the generic level-based rating mapping
          const computerRating = result?.opponent_rating || getRatingFromLevel(computerLevel);
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
          // Use ref to prevent re-render loop (fetchUser updates user object causing re-renders)
          if (fetchUser && !fetchUserCalledRef.current) {
            fetchUserCalledRef.current = true;
            await fetchUser();
            console.log('✅ User rating refreshed in AuthContext (one-time only)');
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

  // Handle Share Replay — generates animated GIF of the game
  const handleShareReplay = async () => {
    // Build moves string from gameHistory or moves prop
    let movesString;
    if (Array.isArray(gameHistory) && gameHistory.length > 0) {
      movesString = encodeGameHistory(gameHistory);
    } else if (typeof moves === 'string' && moves) {
      movesString = moves;
    } else {
      alert('No move data available for replay.');
      return;
    }

    const opponentName = isMultiplayer
      ? (playerColor === 'w' ? result?.black_player?.name : result?.white_player?.name)
      : (championshipData
          ? (playerColor === 'w' ? result?.black_player?.name : result?.white_player?.name)
          : (result?.opponent_name || `Computer Lv.${computerLevel || '?'}`));

    let gameType = 'computer';
    if (championshipData) gameType = 'championship';
    else if (isMultiplayer) gameType = 'multiplayer';

    await shareGameReplay({
      gameData: {
        moves: movesString,
        playerColor,
        playerName: user?.name || 'Player',
        opponentName: opponentName || 'Opponent',
        isWin: isPlayerWin,
        isDraw,
        gameType,
        championshipData
      },
      setIsGenerating: setIsGeneratingGif,
      setProgress: setGifProgress
    });
  };

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
          : (result?.opponent_name || 'Computer'));

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
      {/* Main GameEndCard - centered with room for action buttons */}
      <div ref={gameEndCardRef} style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        height: '100vh',
        padding: window.innerWidth <= 480 ? '10px' : '20px',
        paddingBottom: window.innerWidth <= 480 ? '80px' : '80px',
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch'
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
            top: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            fontSize: '20px',
            cursor: 'pointer',
            zIndex: 10000,
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#bababa',
            fontWeight: 'bold'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.color = '#bababa';
          }}
        >
          &times;
        </button>
      )}

      {/* Action buttons container - single player */}
      {!isMultiplayer && (
        <div style={{
          position: 'fixed',
          bottom: window.innerWidth <= 480 ? '12px' : '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '8px',
          flexWrap: 'nowrap',
          justifyContent: 'center',
          zIndex: 1000,
          maxWidth: window.innerWidth <= 480 ? '95%' : '500px',
          width: '100%',
          padding: '0 12px'
        }}>
          {isAuthenticated ? (
            <>
              <button onClick={handleShareWithFriends} disabled={isTestSharing} style={{
                background: isTestSharing ? '#555' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: 'white', padding: '8px 14px', borderRadius: '8px',
                border: 'none', fontSize: '0.8rem', fontWeight: '700', cursor: isTestSharing ? 'not-allowed' : 'pointer',
                flex: '1 1 auto', whiteSpace: 'nowrap', transition: 'all 0.2s ease',
                opacity: isTestSharing ? 0.6 : 1,
                boxShadow: '0 3px 10px rgba(16, 185, 129, 0.4)'
              }}>
                Share
              </button>
              <button onClick={handleShareReplay} disabled={isGeneratingGif} style={{
                background: isGeneratingGif ? '#555' : 'linear-gradient(135deg, #F97316 0%, #DC2626 100%)',
                color: 'white', padding: '8px 14px', borderRadius: '8px',
                border: 'none', fontSize: '0.8rem', fontWeight: '600',
                cursor: isGeneratingGif ? 'not-allowed' : 'pointer',
                flex: '1 1 auto', whiteSpace: 'nowrap', transition: 'all 0.2s ease',
                opacity: isGeneratingGif ? 0.6 : 1
              }}>
                {isGeneratingGif ? `${gifProgress}%` : '🎬 GIF'}
              </button>
              <button onClick={handleViewInHistory} style={{
                backgroundColor: '#3d3a37', color: '#bababa', padding: '8px 14px', borderRadius: '8px',
                border: '1px solid #4a4744', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
                flex: '1 1 auto', whiteSpace: 'nowrap', transition: 'all 0.2s ease'
              }}>
                History
              </button>
              <button onClick={handlePlayAgain} style={{
                backgroundColor: '#3d3a37', color: '#bababa', padding: '8px 14px', borderRadius: '8px',
                border: '1px solid #4a4744', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
                flex: '1 1 auto', whiteSpace: 'nowrap', transition: 'all 0.2s ease'
              }}>
                Play Again
              </button>
            </>
          ) : (
            <>
              <button onClick={handleLoginRedirect} style={{
                backgroundColor: '#81b64c', color: 'white', padding: '8px 14px', borderRadius: '8px',
                border: 'none', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
                flex: '1 1 auto', whiteSpace: 'nowrap', transition: 'all 0.2s ease'
              }}>
                Login to Save
              </button>
              <button onClick={handlePlayAgain} style={{
                backgroundColor: '#3d3a37', color: '#bababa', padding: '8px 14px', borderRadius: '8px',
                border: '1px solid #4a4744', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
                flex: '1 1 auto', whiteSpace: 'nowrap', transition: 'all 0.2s ease'
              }}>
                Play Again
              </button>
              <button onClick={handleShareReplay} disabled={isGeneratingGif} style={{
                background: isGeneratingGif ? '#555' : 'linear-gradient(135deg, #F97316 0%, #DC2626 100%)',
                color: 'white', padding: '8px 14px', borderRadius: '8px',
                border: 'none', fontSize: '0.8rem', fontWeight: '600',
                cursor: isGeneratingGif ? 'not-allowed' : 'pointer',
                flex: '1 1 auto', whiteSpace: 'nowrap', transition: 'all 0.2s ease',
                opacity: isGeneratingGif ? 0.6 : 1
              }}>
                {isGeneratingGif ? `${gifProgress}%` : '🎬 GIF'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Multiplayer action buttons */}
      {isMultiplayer && (
        <div style={{
          position: 'fixed',
          bottom: window.innerWidth <= 480 ? '12px' : '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '8px',
          flexWrap: 'nowrap',
          justifyContent: 'center',
          zIndex: 1000,
          maxWidth: window.innerWidth <= 480 ? '95%' : '500px',
          width: '100%',
          padding: '0 12px'
        }}>
          {/* Share with Friends button — vibrant green */}
          <button
            onClick={handleShareWithFriends}
            disabled={isTestSharing}
            style={{
              background: isTestSharing ? '#555' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: 'white',
              padding: '10px 16px',
              borderRadius: '12px',
              border: 'none',
              fontSize: '0.82rem',
              fontWeight: '700',
              cursor: isTestSharing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              opacity: isTestSharing ? 0.6 : 1,
              flex: '1 1 auto',
              justifyContent: 'center',
              whiteSpace: 'nowrap',
              boxShadow: '0 3px 10px rgba(16, 185, 129, 0.4)'
            }}
          >
            {isTestSharing ? '⏳' : '🔗'} {isTestSharing ? 'Sharing...' : 'Share'}
          </button>
          {/* Share Replay GIF button — orange/red gradient */}
          <button
            onClick={handleShareReplay}
            disabled={isGeneratingGif}
            style={{
              background: isGeneratingGif ? '#555' : 'linear-gradient(135deg, #F97316 0%, #DC2626 100%)',
              color: 'white',
              padding: '10px 16px',
              borderRadius: '12px',
              border: 'none',
              fontSize: '0.82rem',
              fontWeight: '700',
              cursor: isGeneratingGif ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              opacity: isGeneratingGif ? 0.6 : 1,
              flex: '1 1 auto',
              justifyContent: 'center',
              whiteSpace: 'nowrap',
              boxShadow: '0 3px 10px rgba(249, 115, 22, 0.4)'
            }}
          >
            {isGeneratingGif ? `${gifProgress}%` : '🎬'} {isGeneratingGif ? '' : 'GIF'}
          </button>
          {onNewGame && (
            <button
              onClick={() => onNewGame('random')}
              style={{
                background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                color: 'white',
                padding: '10px 16px',
                borderRadius: '12px',
                border: 'none',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flex: '1 1 auto',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
                boxShadow: '0 3px 10px rgba(59, 130, 246, 0.3)'
              }}
            >
              🎮 New
            </button>
          )}
          {onPreview && (
            <button
              onClick={onPreview}
              style={{
                background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                color: 'white',
                padding: '10px 16px',
                borderRadius: '12px',
                border: 'none',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flex: '1 1 auto',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
                boxShadow: '0 3px 10px rgba(139, 92, 246, 0.3)'
              }}
            >
              👁️ Review
            </button>
          )}
          {championshipData && championshipData.championshipId && (
            <button
              onClick={() => navigate(`/championships/${championshipData.championshipId}`)}
              style={{
                background: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
                color: 'white',
                padding: '10px 16px',
                borderRadius: '12px',
                border: 'none',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flex: '1 1 auto',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
                boxShadow: '0 3px 10px rgba(236, 72, 153, 0.3)'
              }}
            >
              🏆 Champ
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default GameCompletionAnimation;
