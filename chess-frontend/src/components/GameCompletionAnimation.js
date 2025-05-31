// src/components/GameCompletionAnimation.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { saveGameHistory } from "../services/gameHistoryService"; // Assuming this path is correct
import { useAuth } from "../contexts/AuthContext";
import GIF from 'gif.js';
import "./GameCompletionAnimation.css";

const GameCompletionAnimation = ({ result, score, playerColor, onClose, moves }) => {
  const [isVisible, setIsVisible] = useState(false); // Controls card visibility for animation
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

  // Determine win state more robustly
  const isPlayerWin = (() => {
    const lowerResult = result?.toLowerCase() || "";
    const isCheckmate = lowerResult.includes("checkmate");
    const isWhiteWin = lowerResult.includes("white wins") || (isCheckmate && lowerResult.includes("white"));
    const isBlackWin = lowerResult.includes("black wins") || (isCheckmate && lowerResult.includes("black"));

    if (playerColor === "w") {
      return isWhiteWin;
    } else if (playerColor === "b") {
      return isBlackWin;
    } else {
      // Handle cases where playerColor isn't set or is observer?
      // Defaulting to false or checking if 'win' is present generically
      return lowerResult.includes("win") && !lowerResult.includes("wins by"); // Avoid matching 'X wins by timeout' if X is opponent
    }
    // Add more conditions if needed (e.g., resignations, draws)
  })();

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

  const overlayClass = `completion-overlay ${isPlayerWin ? "win" : "loss"} ${
    isVisible ? "visible" : ""
  }`;
  const cardClass = `completion-card ${isVisible ? "visible" : ""}`;
  const icon = isPlayerWin ? "🏆" : "💔"; // Trophy for win, Broken Heart for loss/draw
  const title = isPlayerWin ? "Victory!" : "Game Over"; // Or handle Draw separately

  return (
    <div className={overlayClass}>
      <div className={cardClass}>
        <div className={`result-icon ${isPlayerWin ? "win" : "loss"}`}>
          {icon}
        </div>
        <h1 className="result-title">{title}</h1>

        <div className="result-details">
          <p className="result-text">{result}</p> {/* Display the detailed result */}
          <div className="score-display">
            Score:{" "}
            <span className="positive">
              {Math.abs(score || 0).toFixed(1)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="completion-actions">
          {isAuthenticated ? (
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
          )}
        </div>

        {/* Additional Options */}
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
