// src/components/GameCompletionAnimation.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { saveGameHistory } from "../services/gameHistoryService"; // Assuming this path is correct
import { updateRating } from "../services/ratingService";
import { getRatingFromLevel } from "../utils/eloUtils";
import { useAuth } from "../contexts/AuthContext";
import { isWin, isDraw as isDrawResult, getResultDisplayText } from "../utils/resultStandardization";
import GIF from 'gif.js';
import "./GameCompletionAnimation.css";

const GameCompletionAnimation = ({
  result,
  score,
  playerColor,
  onClose,
  moves,
  onNewGame,
  onBackToLobby,
  onPreview,
  isMultiplayer = false,
  computerLevel = null, // Computer difficulty level (1-16)
  opponentRating = null, // For multiplayer games
  opponentId = null, // For multiplayer games
  gameId = null // Game ID for history tracking
}) => {
  const [isVisible, setIsVisible] = useState(false); // Controls card visibility for animation
  const [selectedColor, setSelectedColor] = useState('random'); // Color preference for new game challenge
  const [ratingUpdate, setRatingUpdate] = useState({
    isLoading: true,
    oldRating: null,
    newRating: null,
    ratingChange: null,
    error: null
  });
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

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
      // Only update rating if user is authenticated
      if (!isAuthenticated || !user) {
        setRatingUpdate(prev => ({ ...prev, isLoading: false }));
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
        const response = await updateRating(ratingData);

        if (response.success) {
          setRatingUpdate({
            isLoading: false,
            oldRating: response.data.old_rating,
            newRating: response.data.new_rating,
            ratingChange: response.data.rating_change,
            error: null
          });
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
      }
    };

    handleRatingUpdate();
  }, [isAuthenticated, user, isPlayerWin, isDraw, isMultiplayer, computerLevel, opponentRating, opponentId, gameId]);

  const exportAsGIF = async () => {
    const canvas = document.createElement('canvas');
    // Setup canvas and capture frames here
    
    const gif = new GIF({
      workerScript: process.env.PUBLIC_URL + '/gif.worker.js',
      quality: 10,
      width: canvas.width,
      height: canvas.height
    });

    // Add frames to gif
    // gif.addFrame(...);
    
    gif.on('finished', (blob) => {
      const link = document.createElement('a');
      link.download = 'chess-game.gif';
      link.href = URL.createObjectURL(blob);
      link.click();
    });

    gif.render();
  };

  const handleContinue = async () => {
    if (isAuthenticated) {
      try {
        await saveGameHistory({
          result,
          score,
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

  const handleLoginRedirect = () => navigate("/login");
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

  // Generate result text for multiplayer games
  const getResultText = () => {
    if (isMultiplayer && result?.white_player && result?.black_player) {
      const { white_player, black_player, end_reason, winner_player } = result;

      if (isDraw) {
        return `Draw by ${end_reason}`;
      }

      const winnerName = winner_player === 'white' ? white_player.name : black_player.name;
      const reasonText = end_reason === 'checkmate' ? 'checkmate' :
                        end_reason === 'resignation' ? 'resignation' :
                        end_reason === 'timeout' ? 'timeout' : end_reason;

      return `${winnerName} wins by ${reasonText}!`;
    }

    // Fallback to standardized result text
    return getResultDisplayText(result);
  };

  const overlayClass = `completion-overlay ${isDraw ? "draw" : (isPlayerWin ? "win" : "loss")} ${
    isVisible ? "visible" : ""
  }`;
  const cardClass = `completion-card ${isVisible ? "visible" : ""}`;
  const icon = isDraw ? "🤝" : (isPlayerWin ? "🏆" : "💔"); // Handshake for draw, Trophy for win, Broken Heart for loss
  const title = isDraw ? "Draw!" : (isPlayerWin ? "Victory!" : "Defeat"); // Handle all three cases

  return (
    <div className={overlayClass}>
      <div className={cardClass}>
        <div className={`result-icon ${isPlayerWin ? "win" : "loss"}`}>
          {icon}
        </div>
        <h1 className="result-title">{title}</h1>

        <div className="result-details">
          <p className="result-text">{getResultText()}</p> {/* Display the detailed result */}

          {/* Rating Change Display */}
          {isAuthenticated && (
            <div className="rating-update-display">
              {ratingUpdate.isLoading ? (
                <p className="rating-loading">Calculating rating...</p>
              ) : ratingUpdate.error ? (
                <p className="rating-error">{ratingUpdate.error}</p>
              ) : ratingUpdate.newRating !== null ? (
                <div className="rating-change-container">
                  <div className="rating-label">Rating:</div>
                  <div className="rating-values">
                    <span className="old-rating">{ratingUpdate.oldRating}</span>
                    <span className={`rating-change ${ratingUpdate.ratingChange >= 0 ? 'positive' : 'negative'}`}>
                      ({ratingUpdate.ratingChange >= 0 ? '+' : ''}{ratingUpdate.ratingChange})
                    </span>
                    <span className="arrow">→</span>
                    <span className="new-rating">{ratingUpdate.newRating}</span>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {!isMultiplayer && (
            <div className="score-display">
              Score:{" "}
              <span className="positive">
                {Math.abs(score || 0).toFixed(1)}
              </span>
            </div>
          )}
          {isMultiplayer && result?.move_count && (
            <div className="move-count-display">
              Game lasted {result.move_count} moves
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="completion-actions">
          {isMultiplayer ? (
            /* Multiplayer specific buttons */
            <div className="multiplayer-actions">
              {/* Color Selection for New Game Challenge */}
              {onNewGame && (
                <div className="color-selection-section">
                  <label className="color-selection-label">Challenge to New Game:</label>
                  <div className="color-selection-options">
                    <label className={`color-option ${selectedColor === 'white' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="color"
                        value="white"
                        checked={selectedColor === 'white'}
                        onChange={(e) => setSelectedColor(e.target.value)}
                      />
                      <span className="color-box white">⚪</span>
                      <span>White</span>
                    </label>
                    <label className={`color-option ${selectedColor === 'black' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="color"
                        value="black"
                        checked={selectedColor === 'black'}
                        onChange={(e) => setSelectedColor(e.target.value)}
                      />
                      <span className="color-box black">⚫</span>
                      <span>Black</span>
                    </label>
                    <label className={`color-option ${selectedColor === 'random' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="color"
                        value="random"
                        checked={selectedColor === 'random'}
                        onChange={(e) => setSelectedColor(e.target.value)}
                      />
                      <span className="color-box random">🎲</span>
                      <span>Random</span>
                    </label>
                  </div>
                  <button
                    onClick={() => {
                      console.log('🆕 Challenge to New Game clicked with color:', selectedColor);
                      onNewGame(selectedColor);
                    }}
                    className="btn btn-primary challenge-btn"
                  >
                    Send Challenge
                  </button>
                </div>
              )}

              {/* Other Action Buttons */}
              {onPreview && (
                <button
                  onClick={() => {
                    console.log('👁️ Preview button clicked');
                    onPreview();
                  }}
                  className="btn btn-secondary"
                >
                  Preview
                </button>
              )}
              {onBackToLobby && (
                <button
                  onClick={() => {
                    console.log('🏠 Back to Lobby button clicked');
                    onBackToLobby();
                  }}
                  className="btn btn-tertiary"
                >
                  Back to Lobby
                </button>
              )}
            </div>
          ) : (
            /* Single player actions */
            isAuthenticated ? (
              <button onClick={handleContinue} className="btn btn-primary btn-continue">
                Continue to Dashboard
              </button>
            ) : (
              <div className="login-prompt">
                <p>Login to save your game history!</p>
                <div className="login-buttons">
                  <button onClick={handleLoginRedirect} className="btn btn-secondary">
                    Login
                  </button>
                  <button onClick={handleContinue} className="btn btn-tertiary">
                    Skip
                  </button>
                </div>
              </div>
            )
          )}
        </div>

        {/* Additional Options */}
        {!isMultiplayer && (
          <div className="completion-additional-buttons">
            <button onClick={handleViewInHistory} className="btn btn-secondary">
              View in History
            </button>
            <button onClick={handlePlayAgain} className="btn btn-secondary">
              Play Again
            </button>
            <button onClick={exportAsGIF} className="btn btn-secondary">
              Export as GIF
            </button>
          </div>
        )}

        {/* Optional: Close button if onClose prop is provided */}
        {onClose && (
            <button onClick={onClose} className="close-button" aria-label="Close">
                &times;
            </button>
        )}
      </div>
    </div>
  );
};

export default GameCompletionAnimation;
