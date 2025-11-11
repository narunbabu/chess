// src/components/GameCompletionAnimation.js
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { saveGameHistory } from "../services/gameHistoryService"; // Assuming this path is correct
import { updateRating } from "../services/ratingService";
import { getRatingFromLevel } from "../utils/eloUtils";
import { useAuth } from "../contexts/AuthContext";
import { isWin, isDraw as isDrawResult, getResultDisplayText } from "../utils/resultStandardization";
import { getGameResultShareMessage } from "../utils/socialShareUtils";
import { uploadGameResultImage } from "../services/sharedResultService";
import GIF from 'gif.js';
import GameEndCard from "./GameEndCard";
import "./GameCompletionAnimation.css";

// Helper function to wait for all images to fully load
const waitForImagesToLoad = async (element) => {
  console.log('⏳ Waiting for all images to load in GameCompletionAnimation...');

  const images = Array.from(element.querySelectorAll('img'));
  console.log(`📸 Found ${images.length} images to check`);

  const imageLoadPromises = images.map((img, index) => {
    return new Promise((resolve) => {
      // Check if image is already loaded
      if (img.complete && img.naturalHeight > 0) {
        console.log(`✅ Image ${index + 1} already loaded`);
        resolve();
      } else {
        console.log(`⏳ Waiting for image ${index + 1} to load...`);

        // Wait for image to load
        img.onload = () => {
          console.log(`✅ Image ${index + 1} loaded successfully`);
          resolve();
        };

        // Handle errors - resolve anyway to not block the process
        img.onerror = () => {
          console.warn(`⚠️ Image ${index + 1} failed to load, continuing anyway`);
          resolve();
        };

        // Timeout after 5 seconds to prevent indefinite waiting
        setTimeout(() => {
          console.warn(`⏱️ Timeout waiting for image ${index + 1}, continuing anyway`);
          resolve();
        }, 5000);
      }
    });
  });

  await Promise.all(imageLoadPromises);
  console.log('✅ All images loaded (or timed out) in GameCompletionAnimation');
};

// Helper function to load an image and convert it to data URL using canvas
// This is more reliable than fetch for handling CORS issues
const loadImageToDataURL = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Use CORS for cross-origin images
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataURL = canvas.toDataURL('image/jpeg', 0.8);
          resolve(dataURL);
        } else {
          reject(new Error('Failed to get canvas context'));
        }
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => {
      reject(new Error(`Failed to load image: ${src}`));
    };
    img.src = src;
  });
};

// Helper function to escape special regex characters
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Helper function to convert all images within an element to data URLs
// This robustly handles image loading for html2canvas capture using canvas extraction.
const convertImagesToDataURLs = async (element) => {
  console.log('🔄 Converting images to data URLs in GameCompletionAnimation...');

  // Handle <img> tags
  const images = Array.from(element.querySelectorAll('img'));
  console.log(`📸 Found ${images.length} <img> tags to convert`);

  await Promise.all(
    images.map(async (img, index) => {
      // Don't re-convert if it's already a data URL
      if (img.src.startsWith('data:')) {
        console.log(`✅ Image ${index + 1} already a data URL`);
        return;
      }

      try {
        console.log(`🔄 Converting image ${index + 1}: ${img.src.substring(0, 50)}...`);
        const dataUrl = await loadImageToDataURL(img.src);
        img.src = dataUrl;
        console.log(`✅ Image ${index + 1} converted successfully`);
      } catch (error) {
        console.error(`❌ Could not convert image ${index + 1} (${img.src}) to data URL:`, error);
        // We continue even if one image fails, so the capture process doesn't halt.
      }
    })
  );

  // Handle CSS background-image properties (for logo, etc.)
  const allElements = Array.from(element.querySelectorAll('*'));
  allElements.push(element); // Include the root element itself

  let bgImageCount = 0;
  await Promise.all(
    allElements.map(async (el, elIndex) => {
      const bgImage = window.getComputedStyle(el).backgroundImage;

      // Check if there's a background-image and it's a URL (not 'none' or gradient)
      if (bgImage && bgImage !== 'none' && bgImage.includes('url(')) {
        bgImageCount++;
        // Extract URL from background-image (handles multiple backgrounds)
        const urlMatches = bgImage.match(/url\(["']?([^"')]+)["']?\)/g);

        if (urlMatches) {
          for (const urlMatch of urlMatches) {
            const url = urlMatch.match(/url\(["']?([^"')]+)["']?\)/)[1];

            // Skip if already a data URL
            if (url.startsWith('data:')) {
              console.log(`✅ Background image already a data URL on element ${elIndex}`);
              continue;
            }

            try {
              console.log(`🔄 Converting background image: ${url.substring(0, 50)}...`);
              const dataUrl = await loadImageToDataURL(url);

              // Replace the URL in the background-image with the data URL
              const newBgImage = bgImage.replace(new RegExp(escapeRegExp(url), 'g'), dataUrl);
              el.style.backgroundImage = newBgImage;
              console.log(`✅ Background image converted successfully on element ${elIndex}`);
            } catch (error) {
              console.error(`❌ Could not convert background image ${url} to data URL on element ${elIndex}:`, error);
              // We continue even if one image fails
            }
          }
        }
      }
    })
  );

  console.log(`✅ Image conversion complete. Found ${bgImageCount} background images.`);
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

  // UNUSED - Commented out to remove ESLint warning
  // Generate result text for multiplayer games
  // const getResultText = () => {
  //   if (isMultiplayer && result?.white_player && result?.black_player) {
  //     const { white_player, black_player, end_reason, winner_player } = result;
  //
  //     if (isDraw) {
  //       return `Draw by ${end_reason}`;
  //     }
  //
  //     const winnerName = winner_player === 'white' ? white_player.name : black_player.name;
  //     const reasonText = end_reason === 'checkmate' ? 'checkmate' :
  //                       end_reason === 'resignation' ? 'resignation' :
  //                       end_reason === 'timeout' ? 'timeout' : end_reason;
  //
  //     return `${winnerName} wins by ${reasonText}!`;
  //   }
  //
  //   // Fallback to standardized result text
  //   return getResultDisplayText(result);
  // };

  // UNUSED - Commented out to remove ESLint warning
  // Export and Share functionality
  // const handleExportEndCard = async () => {
  //   try {
  //     // Wait for card to render
  //     await new Promise(resolve => setTimeout(resolve, 100));
  //
  //     // Find the end card element (clone it for export)
  //     const completionCard = document.querySelector('.completion-card');
  //     if (!completionCard) {
  //       throw new Error('Completion card not found');
  //     }
  //
  //     // Clone the element for export
  //     const clone = completionCard.cloneNode(true);
  //     clone.style.position = 'absolute';
  //     clone.style.left = '-9999px';
  //     clone.style.visibility = 'visible';
  //     clone.classList.add('share-mode'); // Add share-mode for better rendering
  //     document.body.appendChild(clone);
  //
  //     // Wait a bit for styles to apply
  //     await new Promise(resolve => setTimeout(resolve, 100));
  //
  //     const html2canvas = (await import('html2canvas')).default;
  //     const canvas = await html2canvas(clone, {
  //       backgroundColor: null,
  //       scale: 2, // Higher quality
  //       useCORS: true, // Enable CORS to capture external images (avatars)
  //       allowTaint: false,
  //       logging: false
  //     });
  //
  //     // Remove clone
  //     document.body.removeChild(clone);
  //
  //     // Convert to blob and download with medium quality (JPEG format)
  //     canvas.toBlob((blob) => {
  //       if (blob) {
  //         const url = URL.createObjectURL(blob);
  //         const link = document.createElement('a');
  //         link.href = url;
  //         link.download = `chess-game-${Date.now()}.jpg`;
  //         document.body.appendChild(link);
  //         link.click();
  //         document.body.removeChild(link);
  //         URL.revokeObjectURL(url);
  //       }
  //     }, 'image/jpeg', 0.8);
  //   } catch (error) {
  //     console.error('Error exporting end card:', error);
  //     alert('Failed to export end card. Please try again.');
  //   }
  // };

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

      // **CRITICAL FIX**: Wait for all images to fully load first
      await waitForImagesToLoad(cardElement);

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
        allowTaint: false, // Don't allow tainted canvas (required for CORS)
        logging: true, // Enable logging for debugging
        foreignObjectRendering: false, // Disable foreign object rendering for better compatibility
        removeContainer: true, // Remove the temporary container after rendering
        imageTimeout: 15000, // Increase timeout for image loading (15 seconds)
        onclone: (clonedDoc) => {
          console.log('📋 Document cloned in GameCompletionAnimation, preparing for capture...');
          const clonedImages = clonedDoc.querySelectorAll('img');
          clonedImages.forEach((img, idx) => {
            if (img.src && img.src.startsWith('data:')) {
              console.log(`✅ Cloned image ${idx + 1} is using data URL`);
            } else {
              console.warn(`⚠️ Cloned image ${idx + 1} is NOT using data URL: ${img.src.substring(0, 50)}`);
            }
          });
        }
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

  // Test Share - Upload image to server and share URL with preview
  const handleTestShare = async () => {
    console.log('🔵 Test Share started');
    try {
      setIsTestSharing(true);
      console.log('✅ State set to sharing');

      // Wait for GameEndCard to render
      await new Promise(resolve => setTimeout(resolve, 300));
      console.log('✅ Wait completed');

      // Find the actual GameEndCard element
      const cardElement = gameEndCardContentRef.current;
      console.log('🔍 Card element:', cardElement ? 'Found' : 'NOT FOUND');
      if (!cardElement) {
        throw new Error('GameEndCard not found');
      }

      // Add share-mode class for styling
      cardElement.classList.add('share-mode');
      console.log('✅ Share mode class added');

      // **CRITICAL FIX**: Wait for all images to fully load first
      await waitForImagesToLoad(cardElement);
      console.log('✅ All images loaded');

      // Convert all images to data URLs before capture
      await convertImagesToDataURLs(cardElement);
      console.log('✅ Images converted to data URLs');

      // Wait for DOM to update with converted images
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('✅ DOM update wait completed');

      const html2canvas = (await import('html2canvas')).default;
      console.log('✅ html2canvas loaded');

      const canvas = await html2canvas(cardElement, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        useCORS: true, // Enable CORS for cross-origin images
        allowTaint: false, // Don't allow tainted canvas (required for CORS)
        logging: true, // Enable logging for debugging in production
        foreignObjectRendering: false, // Disable foreign object rendering for better compatibility
        removeContainer: true, // Remove the temporary container after rendering
        imageTimeout: 15000, // Increase timeout for image loading (15 seconds)
        onclone: (clonedDoc) => {
          // This function is called with the cloned document before rendering
          console.log('📋 Document cloned, preparing for capture...');
          // Ensure all images are visible in the cloned document
          const clonedImages = clonedDoc.querySelectorAll('img');
          clonedImages.forEach((img, idx) => {
            if (img.src && img.src.startsWith('data:')) {
              console.log(`✅ Cloned image ${idx + 1} is using data URL`);
            } else {
              console.warn(`⚠️ Cloned image ${idx + 1} is NOT using data URL: ${img.src.substring(0, 50)}`);
            }
          });
        }
      });
      console.log('✅ Canvas created:', canvas.width, 'x', canvas.height);

      // Remove share-mode class after capture
      cardElement.classList.remove('share-mode');

      // Convert canvas to data URL (base64)
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      console.log('✅ Image data URL created, length:', imageDataUrl.length);

      // Upload to server
      console.log('📤 Uploading to server...');
      const response = await uploadGameResultImage(imageDataUrl, {
        game_id: gameId,
        user_id: user?.id,
        winner: isPlayerWin ? 'player' : (isDraw ? 'draw' : 'opponent'),
        playerName: user?.name || 'Player',
        opponentName: isMultiplayer ? (playerColor === 'w' ? result?.black_player?.name : result?.white_player?.name) : 'Computer',
        result: result,
        gameMode: isMultiplayer ? 'multiplayer' : 'computer'
      });
      console.log('✅ Server response:', response);

      if (response.success && response.share_url) {
        const shareUrl = response.share_url;

        // Generate share message
        const shareMessage = `🏆 Check out my chess game result!\n\n${shareUrl}`;

        // Copy share URL to clipboard
        try {
          await navigator.clipboard.writeText(shareUrl);
          console.log('Share URL copied to clipboard');
        } catch (clipboardError) {
          console.log('Could not copy to clipboard:', clipboardError);
        }

        // Try native share with URL (works great on WhatsApp)
        if (navigator.share) {
          try {
            await navigator.share({
              title: 'Chess Game Result',
              text: shareMessage,
              url: shareUrl
            });
          } catch (shareError) {
            if (shareError.name !== 'AbortError') {
              console.error('Error sharing:', shareError);
              // Fallback: show share URL
              alert(`Share URL copied!\n\n${shareUrl}\n\nPaste this link on WhatsApp to share with preview!`);
            }
          }
        } else {
          // Desktop fallback: show share URL and instructions
          alert(`Share URL copied!\n\n${shareUrl}\n\nPaste this link on WhatsApp to share with preview!`);
        }
      } else {
        throw new Error('Failed to upload image');
      }

    } catch (error) {
      console.error('Error in test share:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack
      });

      // Show more detailed error message
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      alert(`Failed to create shareable link.\n\nError: ${errorMessage}\n\nCheck console for details.`);

      // Clean up share-mode class on error
      const cardElement = gameEndCardContentRef.current;
      if (cardElement) cardElement.classList.remove('share-mode');
    } finally {
      setIsTestSharing(false);
    }
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
          {/* Test Share button - shares URL with preview */}
          <button
            onClick={handleTestShare}
            disabled={isTestSharing}
            style={{
              backgroundColor: isTestSharing ? '#6B7280' : '#3B82F6',
              color: 'white',
              padding: window.innerWidth <= 480 ? '9px 16px' : '12px 24px',
              borderRadius: '10px',
              border: 'none',
              fontSize: window.innerWidth <= 480 ? '0.85rem' : '1rem',
              fontWeight: '700',
              cursor: isTestSharing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: window.innerWidth <= 480 ? '6px' : '8px',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
              opacity: isTestSharing ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!isTestSharing) {
                e.currentTarget.style.backgroundColor = '#2563EB';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.5)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isTestSharing) {
                e.currentTarget.style.backgroundColor = '#3B82F6';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
              }
            }}
          >
            {isTestSharing ? (
              <>
                <svg
                  className="animate-spin"
                  style={{ width: window.innerWidth <= 480 ? '16px' : '20px', height: window.innerWidth <= 480 ? '16px' : '20px' }}
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
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                Test Share
              </>
            )}
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
