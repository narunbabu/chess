// src/components/GameCompletionAnimation.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { saveGameHistory } from "../services/gameHistoryService"; // Assuming this path is correct
import { useAuth } from "../contexts/AuthContext";
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
  isMultiplayer = false
}) => {
  const [isVisible, setIsVisible] = useState(false); // Controls card visibility for animation
  const [selectedColor, setSelectedColor] = useState('random'); // Color preference for new game challenge
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Start fade-in animation shortly after component mounts
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100); // Short delay to allow mounting before transition

    // Optional: Add logic for closing the modal after a delay or via onClose prop
    // For example, automatically navigate away after 10 seconds if desired.

    return () => clearTimeout(timer);
  }, []); // Runs only once on mount

  // Determine win state for both single player and multiplayer
  const isPlayerWin = (() => {
    // For multiplayer games, use the isPlayerWin field if available
    if (isMultiplayer && typeof result?.isPlayerWin === 'boolean') {
      return result.isPlayerWin;
    }

    // For single player or legacy games, use the original logic
    const lowerResult = (typeof result === 'string' ? result : result?.result || "").toLowerCase();
    const isCheckmate = lowerResult.includes("checkmate");
    const isWhiteWin = lowerResult.includes("white wins") || (isCheckmate && lowerResult.includes("white"));
    const isBlackWin = lowerResult.includes("black wins") || (isCheckmate && lowerResult.includes("black"));

    // Handle different playerColor formats
    const playerColorKey = playerColor === "w" || playerColor === "white" ? "white" : "black";

    if (playerColorKey === "white") {
      return isWhiteWin;
    } else if (playerColorKey === "black") {
      return isBlackWin;
    } else {
      // Handle cases where playerColor isn't set or is observer?
      // Defaulting to false or checking if 'win' is present generically
      return lowerResult.includes("win") && !lowerResult.includes("wins by"); // Avoid matching 'X wins by timeout' if X is opponent
    }
  })();

  // Check if it's a draw
  const isDraw = isMultiplayer
    ? result?.isPlayerDraw || result?.result === '1/2-1/2'
    : (typeof result === 'string' ? result : result?.result || "").toLowerCase().includes("draw") ||
      (typeof result === 'string' ? result : result?.result || "").includes("1/2-1/2");

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

    // Fallback to original result text
    return typeof result === 'string' ? result : result?.result || 'Game ended';
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
