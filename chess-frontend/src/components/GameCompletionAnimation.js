// src/components/GameCompletionAnimation.js
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { saveGameHistory } from "../services/gameHistoryService"; // Assuming this path is correct
import { updateRating } from "../services/ratingService";
import { getRatingFromLevel } from "../utils/eloUtils";
import { useAuth } from "../contexts/AuthContext";
import { isWin, isDraw as isDrawResult, getResultDisplayText } from "../utils/resultStandardization";
import { getGameResultShareMessage } from "../utils/socialShareUtils";
import GIF from 'gif.js';
import GameEndCard from "./GameEndCard";
import "./GameCompletionAnimation.css";

const GameCompletionAnimation = ({
  result,
  score,
  opponentScore,
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
  const [hasProcessedRating, setHasProcessedRating] = useState(false);
  const { isAuthenticated, user, fetchUser } = useAuth();
  const navigate = useNavigate();
  const gameEndCardRef = useRef(null);

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

  // Export and Share functionality
  const handleExportEndCard = async () => {
    try {
      // Wait for card to render
      await new Promise(resolve => setTimeout(resolve, 100));

      // Find the end card element (clone it for export)
      const completionCard = document.querySelector('.completion-card');
      if (!completionCard) {
        throw new Error('Completion card not found');
      }

      // Clone the element for export
      const clone = completionCard.cloneNode(true);
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.visibility = 'visible';
      clone.classList.add('share-mode'); // Add share-mode for better rendering
      document.body.appendChild(clone);

      // Wait a bit for styles to apply
      await new Promise(resolve => setTimeout(resolve, 100));

      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(clone, {
        backgroundColor: null,
        scale: 2, // Higher quality
        useCORS: true, // Enable CORS to capture external images (avatars)
        allowTaint: false,
        logging: false
      });

      // Remove clone
      document.body.removeChild(clone);

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `chess-game-${Date.now()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error exporting end card:', error);
      alert('Failed to export end card. Please try again.');
    }
  };

  const handleShareWithImage = async () => {
    try {
      // Wait for GameEndCard to render
      await new Promise(resolve => setTimeout(resolve, 300));

      // Find the GameEndCard element
      const gameEndCard = gameEndCardRef.current;
      if (!gameEndCard) {
        throw new Error('GameEndCard not found');
      }

      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(gameEndCard, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        useCORS: true, // Enable CORS to capture external images (avatars)
        allowTaint: true,
        logging: false
      });

      // Convert to blob
      canvas.toBlob(async (blob) => {
        if (blob) {
          const file = new File([blob], 'chess-game-result.png', { type: 'image/png' });

          // Generate share message
          const shareMessage = getGameResultShareMessage({
            result: result,
            playerColor: playerColor,
            isWin: isPlayerWin,
            isDraw: isDrawResult(result),
            opponentName: isMultiplayer ? (playerColor === 'w' ? result?.black_player?.name : result?.white_player?.name) : 'Computer'
          });

          // Check if Web Share API is supported
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                title: 'Chess Game Result',
                text: shareMessage,
                files: [file]
              });
            } catch (shareError) {
              if (shareError.name !== 'AbortError') {
                console.error('Error sharing:', shareError);
                // Fallback to download if share fails
                downloadBlob(blob, 'chess-game-result.png');
                alert('Failed to share image. Image has been downloaded instead.');
              }
            }
          } else {
            // Fallback: download the image
            downloadBlob(blob, 'chess-game-result.png');
            alert('Sharing not supported on this device. Image has been downloaded instead.');
          }
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error sharing image:', error);
      alert('Failed to share image. Please try again.');
    }
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

  const overlayClass = `completion-overlay ${isDraw ? "draw" : (isPlayerWin ? "win" : "loss")} ${
    isVisible ? "visible" : ""
  }`;
  const cardClass = `completion-card ${isVisible ? "visible" : ""}`;
  const icon = isDraw ? "🤝" : (isPlayerWin ? "🏆" : "💔"); // Handshake for draw, Trophy for win, Broken Heart for loss
  const title = isDraw ? "Draw!" : (isPlayerWin ? "Victory!" : "Defeat"); // Handle all three cases

  return (
    <div className={overlayClass}>
      {/* Main GameEndCard - now visible and centered */}
      <div ref={gameEndCardRef} style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '20px'
      }}>
        <GameEndCard
          result={result}
          user={user}
          ratingUpdate={ratingUpdate}
          score={score}
          opponentScore={opponentScore}
          playerColor={playerColor}
          isMultiplayer={isMultiplayer}
          computerLevel={computerLevel}
          isAuthenticated={isAuthenticated}
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
            background: 'rgba(255, 255, 255, 0.9)',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            fontSize: '24px',
            cursor: 'pointer',
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 1)';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          &times;
        </button>
      )}

      {/* Action buttons container - positioned at bottom */}
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
          {onNewGame && (
            <button
              onClick={() => onNewGame('random')}
              className="btn btn-primary"
            >
              New Game Challenge
            </button>
          )}
          {onPreview && (
            <button onClick={onPreview} className="btn btn-secondary">
              Preview Game
            </button>
          )}
          {onBackToLobby && (
            <button onClick={onBackToLobby} className="btn btn-secondary">
              Back to Lobby
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default GameCompletionAnimation;
