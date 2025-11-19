// Share utility functions for game completion
// Handles sharing game results across different game types (computer, multiplayer, championship)

import { uploadGameResultImage } from '../services/sharedResultService';
import { waitForImagesToLoad, convertImagesToDataURLs } from './imageUtils';

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

    // Convert canvas to data URL (base64)
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    console.log('✅ Image data URL created, length:', imageDataUrl.length);

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

    // Upload to server
    console.log('📤 Uploading to server...');
    const response = await uploadGameResultImage(imageDataUrl, {
      game_id: gameId,
      user_id: userId,
      winner: isWin ? 'player' : (isDraw ? 'draw' : 'opponent'),
      playerName: userName || 'Player',
      opponentName: opponentName,
      result: result,
      gameMode: gameType,
      championshipData: championshipData // Include championship context
    });
    console.log('✅ Server response:', response);

    if (response.success && response.share_url) {
      const shareUrl = response.share_url;

      // Generate personalized share message
      const shareMessage = generateShareMessage({
        gameType,
        isWin,
        isDraw,
        opponentName,
        championshipData
      });

      // Add share URL to message
      const fullShareMessage = `${shareMessage}\n\n${shareUrl}`;

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
            title: gameType === 'championship'
              ? `Chess Championship Result - ${championshipData?.tournamentName || 'Tournament'}`
              : 'Chess Game Result',
            text: fullShareMessage,
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

    // Check if Web Share API is supported
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: gameType === 'championship'
            ? `Chess Championship Result - ${championshipData?.tournamentName || 'Tournament'}`
            : 'Chess Game Result',
          text: shareMessage,
          files: [file]
        });
      } catch (shareError) {
        if (shareError.name !== 'AbortError') {
          console.error('Error sharing:', shareError);
          // Fallback to download
          downloadBlob(blob, 'chess-game-result.jpg');
          alert('Failed to share image. Image has been downloaded instead.');
        }
      }
    } else {
      // Fallback: download the image
      downloadBlob(blob, 'chess-game-result.jpg');
      alert('Sharing not supported on this device. Image has been downloaded instead.');
    }
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
