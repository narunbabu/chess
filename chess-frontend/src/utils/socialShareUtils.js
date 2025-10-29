// Social sharing utilities for generating share URLs and content

/**
 * Generate WhatsApp share URL
 * @param {string} text - Text to share
 * @param {string} url - URL to share (optional)
 * @returns {string} WhatsApp share URL
 */
export const getWhatsAppShareUrl = (text, url = '') => {
  // Clean up the text for WhatsApp - make it more concise
  let cleanText = text;

  // Remove extra line breaks and make it more WhatsApp-friendly
  cleanText = cleanText.replace(/\n\n+/g, '\n');

  const message = url ? `${cleanText}\n${url}` : cleanText;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
};

/**
 * Generate Facebook share URL
 * @param {string} url - URL to share
 * @returns {string} Facebook share URL
 */
export const getFacebookShareUrl = (url) => {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
};

/**
 * Generate X (Twitter) share URL
 * @param {string} text - Text to share
 * @param {string} url - URL to share (optional)
 * @param {string[]} hashtags - Hashtags to include (optional)
 * @returns {string} X (Twitter) share URL
 */
export const getTwitterShareUrl = (text, url = '', hashtags = []) => {
  const params = new URLSearchParams({
    text,
    ...(url && { url }),
    ...(hashtags.length > 0 && { hashtags: hashtags.join(',') })
  });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
};

/**
 * Generate Telegram share URL
 * @param {string} text - Text to share
 * @param {string} url - URL to share (optional)
 * @returns {string} Telegram share URL
 */
export const getTelegramShareUrl = (text, url = '') => {
  const params = new URLSearchParams({
    text: url ? `${text}\n${url}` : text
  });
  return `https://t.me/share/url?${params.toString()}`;
};

/**
 * Generate email share URL
 * @param {string} subject - Email subject
 * @param {string} body - Email body
 * @returns {string} Email share URL
 */
export const getEmailShareUrl = (subject, body) => {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (err) {
      document.body.removeChild(textArea);
      return false;
    }
  }
};

/**
 * Generate a shareable game URL
 * @param {string} gameId - Game ID
 * @returns {string} Shareable game URL
 */
export const getShareableGameUrl = (gameId) => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/share/game/${gameId}`;
};

/**
 * Generate friend invitation message
 * @param {string} userName - Name of the user sending invitation
 * @param {string} appUrl - URL to the chess app
 * @returns {string} Invitation message
 */
export const getFriendInvitationMessage = (userName, appUrl = 'www.chess99.com') => {
  return `Hey! ${userName} invites you to play chess together on Chess Web!\n\n🌐 Register and join at: ${appUrl}\n\n🏆 Challenge friends, improve your skills, and become a chess master! ♟️`;
};

/**
 * Generate game result share message
 * @param {object} gameData - Game result data
 * @returns {string} Share message
 */
export const getGameResultShareMessage = (gameData) => {
  const { result, playerColor, isWin, isDraw, opponentName, playerName } = gameData;

  // Create a concise, clean message for WhatsApp/social media
  if (isDraw) {
    return `🤝 I drew against ${opponentName || 'opponent'} in an exciting chess match! 🎯\n\nChallenge me on Chess99.com ♟️`;
  } else if (isWin) {
    return `🏆 I defeated ${opponentName || 'opponent'} in chess! ♟️\n\nThink you can do better? Play me on Chess99.com! 🎯`;
  } else {
    return `♟️ I played against ${opponentName || 'opponent'} in chess! 🎯\n\nChallenge me to a rematch on Chess99.com! 🏆`;
  }
};

/**
 * Open share dialog (uses native Web Share API if available)
 * @param {object} shareData - Data to share
 * @returns {Promise<boolean>} Success status
 */
export const openNativeShare = async (shareData) => {
  if (navigator.share) {
    try {
      await navigator.share({
        title: shareData.title,
        text: shareData.text,
        url: shareData.url,
        ...(shareData.files && { files: shareData.files })
      });
      return true;
    } catch (err) {
      if (err.name === 'AbortError') {
        // User cancelled the share
        return false;
      }
      console.error('Error sharing:', err);
      return false;
    }
  }
  return false; // Web Share API not available
};

/**
 * Download blob as file
 * @param {Blob} blob - Blob to download
 * @param {string} filename - Filename
 */
export const downloadBlob = (blob, filename) => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

/**
 * Check if Instagram app is installed (mobile)
 * Note: Instagram doesn't have a web share API, so we redirect to app
 * @returns {boolean}
 */
export const isInstagramAvailable = () => {
  // Instagram sharing is primarily mobile-only
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  return isMobile;
};

/**
 * Open Instagram with content (mobile only)
 * Note: Instagram doesn't support direct web sharing
 * Best approach is to copy link and show instructions
 * @param {string} message - Message with instructions
 */
export const shareToInstagram = async (message) => {
  // Copy to clipboard and show instructions
  const success = await copyToClipboard(message);
  if (success) {
    return {
      success: true,
      message: 'Link copied! Open Instagram and paste it in a story or post.'
    };
  }
  return {
    success: false,
    message: 'Failed to copy link. Please copy manually.'
  };
};
