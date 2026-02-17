// Share utility functions for game completion
// Handles sharing game results across different game types (computer, multiplayer, championship)

import { uploadGameResultImage } from '../services/sharedResultService';
import { waitForImagesToLoad, convertImagesToDataURLs } from './imageUtils';
import { generateGameGIF, downloadBlob as downloadBlobGif } from './gifExportUtils';

/**
 * Generate share message based on game type and result
 * @param {Object} params - Share message parameters
 * @param {string} params.gameType - 'computer' | 'multiplayer' | 'championship'
 * @param {boolean} params.isWin - Whether player won
 * @param {boolean} params.isDraw - Whether game was a draw
 * @param {string} params.opponentName - Opponent's name
 * @param {Object} params.championshipData - Championship-specific data (optional)
 * @returns {string} Share message
 */
export const generateShareMessage = ({
  gameType,
  isWin,
  isDraw,
  opponentName,
  championshipData = null
}) => {
  // Championship game messages
  if (gameType === 'championship' && championshipData) {
    const { tournamentName, round, standing, points } = championshipData;

    if (isDraw) {
      return `♟️ Just played Round ${round} in ${tournamentName} against ${opponentName} at Chess99.com!\n\nGame ended in a draw. Can you do better?\n\nJoin the tournament and challenge me!`;
    } else if (isWin) {
      return `🏆 Victory in ${tournamentName}! I defeated ${opponentName} in Round ${round} at Chess99.com!\n\n${standing ? `Current Standing: ${standing}\n` : ''}${points ? `Championship Points: ${points}\n` : ''}\nThink you can beat me? Join the tournament now!`;
    } else {
      return `♟️ Competed in Round ${round} of ${tournamentName} against ${opponentName} at Chess99.com!\n\nCan you avenge my defeat? Join the tournament and challenge me!`;
    }
  }

  // Regular multiplayer/computer game messages
  if (isDraw) {
    return `♟️ I just played an exciting chess game against ${opponentName} at Chess99.com!\n\nGame ended in a draw. Can you do better?`;
  } else if (isWin) {
    return `🏆 Victory! I just defeated ${opponentName} in an epic chess battle at Chess99.com!\n\nThink you can beat me? Challenge me now!`;
  } else {
    return `♟️ Just played an intense chess match against ${opponentName} at Chess99.com!\n\nCan you avenge my defeat? Play now!`;
  }
};

/**
 * Share game result with image upload (🎉 Share with Friends functionality)
 * Uploads image to server and creates shareable URL with preview
 * @param {Object} params - Share parameters
 * @param {HTMLElement} params.cardElement - DOM element to capture
 * @param {Object} params.gameData - Game data for share message
 * @param {Function} params.setIsSharing - State setter for loading indicator
 * @returns {Promise<void>}
 */
export const shareGameWithFriends = async ({
  cardElement,
  gameData,
  setIsSharing
}) => {
  console.log('🔵 Share with Friends started');

  try {
    setIsSharing(true);
    console.log('✅ State set to sharing');

    // Wait for card to render
    await new Promise(resolve => setTimeout(resolve, 300));
    console.log('✅ Wait completed');

    if (!cardElement) {
      throw new Error('Card element not found');
    }
    console.log('🔍 Card element: Found');

    // Add share-mode class for styling
    cardElement.classList.add('share-mode');
    console.log('✅ Share mode class added');

    // Wait for all images to fully load
    await waitForImagesToLoad(cardElement);
    console.log('✅ All images loaded');

    // Convert all images to data URLs before capture
    await convertImagesToDataURLs(cardElement);
    console.log('✅ Images converted to data URLs');

    // Wait for DOM to update with converted images
    await new Promise(resolve => setTimeout(resolve, 200));
    console.log('✅ DOM update wait completed');

    // Dynamically import html2canvas
    const html2canvas = (await import('html2canvas')).default;
    console.log('✅ html2canvas loaded');

    // Capture the card as canvas
    const canvas = await html2canvas(cardElement, {
      backgroundColor: '#ffffff',
      scale: 2, // Higher quality
      useCORS: true,
      allowTaint: false,
      logging: true,
      foreignObjectRendering: false,
      removeContainer: true,
      imageTimeout: 15000,
      onclone: (clonedDoc) => {
        console.log('📋 Document cloned, preparing for capture...');
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

    // Prepare share data
    const {
      gameId,
      userId,
      userName,
      isWin,
      isDraw,
      opponentName,
      result,
      gameType,
      championshipData
    } = gameData;

    // Generate share message early (needed for both native and fallback)
    const shareMessage = generateShareMessage({
      gameType,
      isWin,
      isDraw,
      opponentName,
      championshipData
    });

    // Convert canvas to blob for native share (do this BEFORE async upload to preserve user gesture)
    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.8);
    });
    console.log('✅ Image blob created, size:', blob?.size);

    if (!blob) {
      throw new Error('Failed to create image from canvas');
    }

    const file = new File([blob], 'chess-game-result.jpg', { type: 'image/jpeg' });

    // Try native share FIRST (shows OS share dialog with all available apps)
    // Must happen immediately after user gesture, before any async server calls
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        console.log('📱 Trying native share with file...');
        const shareText = `${shareMessage}\n\nPlay at chess99.com`;
        await navigator.share({
          title: 'Chess Game Result',
          text: shareText,
          files: [file]
        });
        console.log('✅ Native share completed successfully');

        // Also upload to server in background for link sharing
        try {
          const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          uploadGameResultImage(imageDataUrl, {
            game_id: gameId,
            user_id: userId,
            winner: isWin ? 'player' : (isDraw ? 'draw' : 'opponent'),
            playerName: userName || 'Player',
            opponentName: opponentName,
            result: result,
            gameMode: gameType,
            championshipData: championshipData
          }).catch(err => console.log('Background upload failed (non-critical):', err));
        } catch (bgErr) {
          // Non-critical
        }

        return; // Native share succeeded, exit
      } catch (shareError) {
        if (shareError.name === 'AbortError') {
          console.log('User cancelled native share');
          return; // User cancelled, exit
        }
        console.warn('Native share failed, falling back to server upload:', shareError);
        // Fall through to upload+link approach
      }
    }

    // Fallback: Upload to server and create shareable link
    console.log('📤 Uploading to server...');
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    console.log('✅ Image data URL created, length:', imageDataUrl.length);

    const response = await uploadGameResultImage(imageDataUrl, {
      game_id: gameId,
      user_id: userId,
      winner: isWin ? 'player' : (isDraw ? 'draw' : 'opponent'),
      playerName: userName || 'Player',
      opponentName: opponentName,
      result: result,
      gameMode: gameType,
      championshipData: championshipData
    });
    console.log('✅ Server response:', response);

    if (response.success && response.share_url) {
      const shareUrl = response.share_url;
      const fullShareMessage = `${shareMessage}\n\n${shareUrl}`;

      // Copy share URL to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        console.log('Share URL copied to clipboard');
      } catch (clipboardError) {
        console.log('Could not copy to clipboard:', clipboardError);
      }

      // Try native share with link (no file, just text + URL)
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Chess Game Result',
            text: fullShareMessage,
            url: shareUrl
          });
          return;
        } catch (shareErr) {
          if (shareErr.name === 'AbortError') return;
          // Fall through to WhatsApp
        }
      }

      // Final fallback: Open WhatsApp with share message
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const whatsappUrl = isMobile
        ? `whatsapp://send?text=${encodeURIComponent(fullShareMessage)}`
        : `https://wa.me/?text=${encodeURIComponent(fullShareMessage)}`;

      window.open(whatsappUrl, '_blank');
      alert(`Share link created!\n\n${shareUrl}\n\nLink copied to clipboard.`);
    } else {
      throw new Error('Failed to upload image');
    }

  } catch (error) {
    console.error('Error in share with friends:', error);
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
    if (cardElement) cardElement.classList.remove('share-mode');
  } finally {
    setIsSharing(false);
  }
};

/**
 * Share game result with native share (direct image file)
 * For devices that support native file sharing
 * @param {Object} params - Share parameters
 * @param {HTMLElement} params.cardElement - DOM element to capture
 * @param {Object} params.gameData - Game data for share message
 * @param {Function} params.setIsSharing - State setter for loading indicator
 * @returns {Promise<void>}
 */
export const shareGameNative = async ({
  cardElement,
  gameData,
  setIsSharing
}) => {
  try {
    setIsSharing(true);

    // Wait for card to render
    await new Promise(resolve => setTimeout(resolve, 300));

    if (!cardElement) {
      throw new Error('Card element not found');
    }

    // Add share-mode class for styling
    cardElement.classList.add('share-mode');

    // Wait for all images to fully load
    await waitForImagesToLoad(cardElement);

    // Convert all images to data URLs before capture
    await convertImagesToDataURLs(cardElement);

    // Wait for DOM to update
    await new Promise(resolve => setTimeout(resolve, 200));

    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(cardElement, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: true,
      foreignObjectRendering: false,
      removeContainer: true,
      imageTimeout: 15000
    });

    // Remove share-mode class after capture
    cardElement.classList.remove('share-mode');

    // Convert to blob
    const blob = await new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8);
    });

    const file = new File([blob], 'chess-game-result.jpg', { type: 'image/jpeg' });

    // Generate share message
    const { gameType, isWin, isDraw, opponentName, championshipData } = gameData;
    const shareMessage = generateShareMessage({
      gameType,
      isWin,
      isDraw,
      opponentName,
      championshipData
    });

    // Copy message to clipboard
    try {
      await navigator.clipboard.writeText(shareMessage);
      console.log('Share message copied to clipboard');
    } catch (clipboardError) {
      console.log('Could not copy to clipboard:', clipboardError);
    }

    // Download the image and open WhatsApp with the message
    // navigator.share() with files fails after async operations (gesture context expires)
    downloadBlob(blob, 'chess-game-result.jpg');

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const whatsappUrl = isMobile
      ? `whatsapp://send?text=${encodeURIComponent(shareMessage)}`
      : `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;

    window.open(whatsappUrl, '_blank');
  } catch (error) {
    console.error('Error sharing image:', error);
    alert('Failed to share image. Please try again.');
    if (cardElement) cardElement.classList.remove('share-mode');
  } finally {
    setIsSharing(false);
  }
};

/**
 * Helper function to download a blob as a file
 * @param {Blob} blob - Blob to download
 * @param {string} filename - Filename for download
 */
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

/**
 * Share animated game replay as GIF
 * Generates GIF, then uses native share (mobile) or share menu callback (desktop)
 * @param {Object} params - Share parameters
 * @param {Object} params.gameData - Game data for GIF generation and share message
 * @param {Function} params.setIsGenerating - State setter for loading indicator
 * @param {Function} params.setProgress - State setter for progress (0-100)
 * @param {Function} params.onShareReady - Callback for desktop fallback share menu (receives { blob, message, filename })
 * @returns {Promise<void>}
 */
export const shareGameReplay = async ({
  gameData,
  setIsGenerating,
  setProgress,
  onShareReady
}) => {
  console.log('🎬 Share Replay started');

  try {
    setIsGenerating(true);
    setProgress(0);

    const {
      moves,
      playerColor,
      playerName,
      opponentName,
      isWin,
      isDraw,
      gameType,
      championshipData,
      boardTheme
    } = gameData;

    // Determine result text
    let resultText;
    if (isDraw) {
      resultText = 'Draw!';
    } else if (isWin) {
      resultText = playerColor === 'w' ? 'White wins!' : 'Black wins!';
    } else {
      resultText = playerColor === 'w' ? 'Black wins!' : 'White wins!';
    }

    // Generate GIF
    console.log('🎬 Generating GIF...');
    const gifBlob = await generateGameGIF(
      {
        moves,
        playerColor,
        playerName: playerName || 'Player',
        opponentName: opponentName || 'Opponent',
        resultText,
        isWin,
        isDraw
      },
      {
        boardSize: 400,
        quality: 10,
        autoSpeed: true,
        boardTheme: boardTheme || 'classic',
        onProgress: (p) => {
          setProgress(Math.round(p * 100));
        }
      }
    );

    console.log('✅ GIF generated, size:', (gifBlob.size / 1024).toFixed(1), 'KB');

    // Generate share message with chess99 link
    const baseMessage = generateShareMessage({
      gameType: gameType || 'computer',
      isWin,
      isDraw,
      opponentName: opponentName || 'Opponent',
      championshipData
    });

    const shareMessage = `${baseMessage}\n\n♟️ Play chess online free at https://chess99.com\n🎮 Challenge me now!`;
    const filename = `chess99-replay-${Date.now()}.gif`;

    // Try native share with file (mobile — shows WhatsApp, Instagram, Facebook, etc.)
    const gifFile = new File([gifBlob], filename, { type: 'image/gif' });

    if (navigator.share && navigator.canShare?.({ files: [gifFile] })) {
      try {
        await navigator.share({
          title: 'Chess99 Game Replay',
          text: shareMessage,
          files: [gifFile]
        });
        console.log('✅ Native share completed');
        return;
      } catch (err) {
        if (err.name === 'AbortError') {
          console.log('User cancelled native share');
          return;
        }
        console.warn('Native share failed, falling back:', err);
      }
    }

    // Desktop/fallback: show share menu via callback
    if (onShareReady) {
      onShareReady({ blob: gifBlob, message: shareMessage, filename });
      return;
    }

    // Ultimate fallback: download + WhatsApp
    downloadBlobGif(gifBlob, filename);
    try {
      await navigator.clipboard.writeText(shareMessage);
    } catch (e) { /* ignore */ }

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const whatsappUrl = isMobile
      ? `whatsapp://send?text=${encodeURIComponent(shareMessage)}`
      : `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    window.open(whatsappUrl, '_blank');

  } catch (error) {
    console.error('Error generating game replay:', error);
    alert(`Failed to generate game replay.\n\nError: ${error.message}`);
  } finally {
    setIsGenerating(false);
    setProgress(0);
  }
};

/**
 * Share animated game replay as video (WebM/MP4)
 * Generates video via MediaRecorder, then uses native share or share menu callback
 */
export const shareGameVideo = async ({
  gameData,
  format = 'portrait',
  setIsGenerating,
  setProgress,
  onShareReady
}) => {
  console.log('📹 Share Video started, format:', format);

  try {
    setIsGenerating(true);
    setProgress(0);

    // Dynamic import to keep bundle small
    const { generateGameVideo } = await import('./videoExportUtils');

    const {
      moves, playerColor, playerName, opponentName,
      isWin, isDraw, gameType, championshipData, boardTheme
    } = gameData;

    let resultText;
    if (isDraw) resultText = 'Draw!';
    else if (isWin) resultText = playerColor === 'w' ? 'White wins!' : 'Black wins!';
    else resultText = playerColor === 'w' ? 'Black wins!' : 'White wins!';

    const videoBlob = await generateGameVideo(
      {
        moves,
        playerColor,
        playerName: playerName || 'Player',
        opponentName: opponentName || 'Opponent',
        resultText,
        isWin,
        isDraw
      },
      {
        format,
        boardTheme: boardTheme || 'classic',
        onProgress: (p) => setProgress(Math.round(p * 100))
      }
    );

    console.log('✅ Video generated:', (videoBlob.size / 1024 / 1024).toFixed(1), 'MB');

    const baseMessage = generateShareMessage({
      gameType: gameType || 'computer',
      isWin,
      isDraw,
      opponentName: opponentName || 'Opponent',
      championshipData
    });
    const shareMessage = `${baseMessage}\n\n♟️ Play chess online free at https://chess99.com\n🎮 Challenge me now!`;

    const ext = videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
    const filename = `chess99-replay-${Date.now()}.${ext}`;

    // Try native share with video file
    const videoFile = new File([videoBlob], filename, { type: videoBlob.type });
    if (navigator.share && navigator.canShare?.({ files: [videoFile] })) {
      try {
        await navigator.share({
          title: 'Chess99 Game Replay',
          text: shareMessage,
          files: [videoFile]
        });
        console.log('✅ Native video share completed');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn('Native share failed, falling back:', err);
      }
    }

    // Desktop fallback: share menu
    if (onShareReady) {
      onShareReady({ blob: videoBlob, message: shareMessage, filename });
      return;
    }

    // Ultimate fallback: download
    downloadBlobGif(videoBlob, filename);
    try { await navigator.clipboard.writeText(shareMessage); } catch (e) { /* ignore */ }

  } catch (error) {
    console.error('Error generating video:', error);
    alert(`Failed to generate video.\n\nError: ${error.message}`);
  } finally {
    setIsGenerating(false);
    setProgress(0);
  }
};
