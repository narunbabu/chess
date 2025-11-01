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

// Helper function to convert all images within an element to data URLs
// This robustly handles image loading for html2canvas capture.
const convertImagesToDataURLs = async (element) => {
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map(async (img) => {
      // Don't re-convert if it's already a data URL
      if (img.src.startsWith('data:')) return;

      try {
        const response = await fetch(img.src);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        const blob = await response.blob();
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        img.src = dataUrl;
      } catch (error) {
        console.error(`Could not convert image ${img.src} to data URL:`, error);
      }
    })
  );
};

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

      // Convert to blob and download with medium quality (JPEG format)
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `chess-game-${Date.now()}.jpg`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      }, 'image/jpeg', 0.8);
    } catch (error) {
      console.error('Error exporting end card:', error);
      alert('Failed to export end card. Please try again.');
    }
  };

  const handleShareWithImage = async () => {
    try {
      // Wait for GameEndCard to render
      await new Promise(resolve => setTimeout(resolve, 300));

      // Find the actual GameEndCard element (not the wrapper)
      const cardElement = gameEndCardContentRef.current;
      if (!cardElement) {
        throw new Error('GameEndCard not found');
      }

      // Add share-mode class for styling
      cardElement.classList.add('share-mode');

      // **CRITICAL FIX**: Convert all images to data URLs before capture
      // This ensures logos, avatars, and background images load properly
      await convertImagesToDataURLs(cardElement);

      // Wait for DOM to update with converted images
      await new Promise(resolve => setTimeout(resolve, 200));

      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardElement, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        useCORS: true, // Enable CORS to capture external images (avatars)
        allowTaint: false, // Not needed since images are already data URLs
        logging: false
      });

      // Remove share-mode class after capture
      cardElement.classList.remove('share-mode');

      // Convert to blob with medium quality (JPEG format)
      canvas.toBlob(async (blob) => {
        if (blob) {
          const file = new File([blob], 'chess-game-result.jpg', { type: 'image/jpeg' });

          // Generate share message
          const shareMessage = getGameResultShareMessage({
            result: result,
            playerColor: playerColor,
            isWin: isPlayerWin,
            isDraw: isDrawResult(result),
            opponentName: isMultiplayer ? (playerColor === 'w' ? result?.black_player?.name : result?.white_player?.name) : 'Computer'
          });

          // Copy message to clipboard for easy pasting (WhatsApp workaround)
          try {
            await navigator.clipboard.writeText(shareMessage);
            console.log('Share message copied to clipboard');
          } catch (clipboardError) {
            console.log('Could not copy to clipboard:', clipboardError);
          }

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
                downloadBlob(blob, 'chess-game-result.jpg');
                alert('Failed to share image. Image has been downloaded instead.');
              }
            }
          } else {
            // Fallback: download the image
            downloadBlob(blob, 'chess-game-result.jpg');
            alert('Sharing not supported on this device. Image has been downloaded instead.');
          }
        }
      }, 'image/jpeg', 0.8);
    } catch (error) {
      console.error('Error sharing image:', error);
      alert('Failed to share image. Please try again.');
      // Clean up share-mode class on error
      const cardElement = gameEndCardContentRef.current;
      if (cardElement) cardElement.classList.remove('share-mode');
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
      {/* Main GameEndCard - now visible and centered with extra bottom padding for action buttons */}
      <div ref={gameEndCardRef} style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        minHeight: '100vh',
        padding: window.innerWidth <= 480 ? '10px' : '20px',
        paddingTop: window.innerWidth <= 480 ? '50px' : '80px', // Extra top padding for close button
        paddingBottom: window.innerWidth <= 480 ? '90px' : '120px', // Extra bottom padding for action buttons
        overflowY: 'auto' // Allow scrolling
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
          <button
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
          </button>
          {onNewGame && (
            <button
              onClick={() => onNewGame('random')}
              style={{
                backgroundColor: '#4F46E5',
                color: 'white',
                padding: window.innerWidth <= 480 ? '8px 12px' : '10px 18px',
                borderRadius: '8px',
                border: 'none',
                fontSize: window.innerWidth <= 480 ? '0.8rem' : '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#4338CA';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#4F46E5';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(79, 70, 229, 0.3)';
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>🎮</span>
              New Game Challenge
            </button>
          )}
          {onPreview && (
            <button
              onClick={onPreview}
              style={{
                backgroundColor: '#6B7280',
                color: 'white',
                padding: window.innerWidth <= 480 ? '8px 12px' : '10px 18px',
                borderRadius: '8px',
                border: 'none',
                fontSize: window.innerWidth <= 480 ? '0.8rem' : '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 2px 8px rgba(107, 114, 128, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#4B5563';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(107, 114, 128, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#6B7280';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(107, 114, 128, 0.3)';
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>👁️</span>
              Preview Game
            </button>
          )}
          
          {onBackToLobby && (
            <button
              onClick={onBackToLobby}
              style={{
                backgroundColor: '#6B7280',
                color: 'white',
                padding: window.innerWidth <= 480 ? '8px 12px' : '10px 18px',
                borderRadius: '8px',
                border: 'none',
                fontSize: window.innerWidth <= 480 ? '0.8rem' : '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 2px 8px rgba(107, 114, 128, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#4B5563';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(107, 114, 128, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#6B7280';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(107, 114, 128, 0.3)';
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>🏠</span>
              Back to Lobby
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default GameCompletionAnimation;
