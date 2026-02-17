import React, { useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { shareGameWithFriends } from '../utils/shareUtils';
import { waitForImagesToLoad, convertImagesToDataURLs } from '../utils/imageUtils';
import { isWin as isWinUtil, isDraw as isDrawUtil } from '../utils/resultStandardization';
import './GameEndCard.css';

// Note: Image and share utility functions have been moved to utils/imageUtils.js and utils/shareUtils.js

// Social share URLs - Note: These platforms don't support direct image URLs in share parameters
// Images are only supported via Web Share API (navigator.share with files) on mobile devices
const SHARE_URLS = {
  whatsapp: (text) => `https://wa.me/?text=${encodeURIComponent(text)}`,
  facebook: (text) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://chess99.com')}`,
  twitter: (text) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent('https://chess99.com')}`,
  linkedin: (text) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://chess99.com')}`
};


const GameEndCard = React.forwardRef(({
  result,
  user,
  ratingUpdate,
  className = '',
  score,
  opponentScore,
  playerColor,
  isMultiplayer,
  computerLevel,
  isAuthenticated,
  championshipData = null, // Championship info: { tournamentName, round, matchId, standing, points }
  onClose = null, // Close handler for the card
  sharePlayerName = null, // Custom player name for sharing (guest users)
  hideShareButton = false // Hide share button when card is used for capturing only
}, forwardedRef) => {
  const internalRef = useRef(null);
  const cardRef = forwardedRef || internalRef;
  const [isSharing, setIsSharing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareImageUrl, setShareImageUrl] = useState(null);

  const {
    isPlayerWin,
    isDraw,
    playersInfo,
    resultText,
    icon,
    title,
    gameDurationText
  } = useMemo(() => {
    // Debug logging to understand user data issues
    console.log('GameEndCard user data debug:', {
      user: user,
      isAuthenticated: isAuthenticated,
      playerColor: playerColor,
      resultUserId: result.user_id,
      resultWinnerUserId: result.winner_user_id,
      gameMode: result.game_mode,
      whitePlayer: result.white_player,
      blackPlayer: result.black_player,
      whitePlayerAvatar: result.white_player?.avatar,
      blackPlayerAvatar: result.black_player?.avatar,
      whitePlayerEmail: result.white_player?.email,
      blackPlayerEmail: result.black_player?.email,
      userEmail: user?.email
    });

    const userId = user?.id;
    const hasUser = !!userId && isAuthenticated;

    // Fix result detection - handle multiple formats properly
    let isPlayerWin = false;
    if (userId && result.winner_user_id) {
      // Multiplayer games: check if winner_user_id matches current user
      isPlayerWin = result.winner_user_id === userId;
    } else if (result.winner_player && result.player_color) {
      // Check if winner_player (white/black) matches player's color
      const playerColorFull = result.player_color === 'w' ? 'white' : 'black';
      isPlayerWin = result.winner_player === playerColorFull;
    } else if (result.winner === 'player') {
      // Standardized format: direct winner indication
      isPlayerWin = true;
    } else if (result.winner === 'opponent') {
      // Standardized format: opponent won
      isPlayerWin = false;
    } else if (result.result?.winner === 'player') {
      // Legacy nested format: player won
      isPlayerWin = true;
    } else if (result.result?.winner === 'opponent') {
      // Legacy nested format: opponent won
      isPlayerWin = false;
    }

    const isDraw = result.result === '1/2-1/2' || result.result === 'Draw' || result.end_reason === 'draw' || result.result?.status === 'draw';

    // Handle cases where white_player and black_player might not exist
    // For computer games: use !isMultiplayer as primary check, with result.game_mode as fallback
    const isComputerGame = !isMultiplayer || result.game_mode === 'computer' || result.game_mode === 'local_ai';
    const playerIsWhite = result.player_color === 'w' || playerColor === 'white' || playerColor?.toLowerCase() === 'white';

    // Use the provided computerLevel if available, otherwise fall back to result.computer_level
    const effectiveComputerLevel = computerLevel !== undefined ? computerLevel : result.computer_level;

    // Determine the effective user name - prioritize sharePlayerName over user?.name
    const effectiveUserName = sharePlayerName || user?.name || 'Player';

    console.log('Player assignment debug:', {
      isComputerGame,
      playerIsWhite,
      computerLevel,
      effectiveComputerLevel,
      userName: user?.name,
      sharePlayerName: sharePlayerName,
      effectiveUserName: effectiveUserName,
      opponentName: result.opponent_name
    });

    // Determine opponent name and avatar for computer games
    // Use synthetic opponent data if available, otherwise fall back to generic labels
    const computerOpponentName = result.opponent_name || `Computer Level ${effectiveComputerLevel || 8}`;
    const computerOpponentRating = result.opponent_rating || (effectiveComputerLevel ? 1000 + (effectiveComputerLevel * 100) : 1800);
    const computerOpponentAvatar = result.opponent_avatar_url || null;
    // If synthetic opponent has an avatar URL, don't mark as isComputer so we show the image
    const hasSyntheticAvatar = !!result.opponent_avatar_url;

    // If result already has player objects from backend, use them with merged data
    const white_player = result.white_player ? {
      ...result.white_player, // Preserve all backend data including email
      name: sharePlayerName && playerIsWhite ? sharePlayerName : result.white_player.name, // Override with sharePlayerName if sharing
      isComputer: playerIsWhite ? false : (isComputerGame && !hasSyntheticAvatar)
    } : {
      id: playerIsWhite ? result.user_id : null,
      name: playerIsWhite ? effectiveUserName : (isComputerGame ? computerOpponentName : (result.opponent_name || 'Opponent')),
      email: playerIsWhite ? (user?.email || null) : null,
      rating: playerIsWhite ? (user?.rating || 1200) : (isComputerGame ? computerOpponentRating : 1200),
      is_provisional: playerIsWhite ? (user?.is_provisional || false) : false,
      // Check multiple avatar field names from backend
      avatar_url: playerIsWhite ? (user?.avatar_url || user?.avatar) : (isComputerGame ? (computerOpponentAvatar || '🤖') : null),
      avatar: playerIsWhite ? (user?.avatar || user?.avatar_url) : (isComputerGame ? (computerOpponentAvatar || '🤖') : null),
      isComputer: playerIsWhite ? false : (isComputerGame && !hasSyntheticAvatar)
    };

    const black_player = result.black_player ? {
      ...result.black_player, // Preserve all backend data including email
      name: sharePlayerName && !playerIsWhite ? sharePlayerName : result.black_player.name, // Override with sharePlayerName if sharing
      isComputer: !playerIsWhite ? false : (isComputerGame && !hasSyntheticAvatar)
    } : {
      id: !playerIsWhite ? result.user_id : null,
      name: !playerIsWhite ? effectiveUserName : (isComputerGame ? computerOpponentName : (result.opponent_name || 'Opponent')),
      email: !playerIsWhite ? (user?.email || null) : null,
      rating: !playerIsWhite ? (user?.rating || 1200) : (isComputerGame ? computerOpponentRating : 1200),
      is_provisional: !playerIsWhite ? (user?.is_provisional || false) : false,
      // Check multiple avatar field names from backend
      avatar_url: !playerIsWhite ? (user?.avatar_url || user?.avatar) : (isComputerGame ? (computerOpponentAvatar || '🤖') : null),
      avatar: !playerIsWhite ? (user?.avatar || user?.avatar_url) : (isComputerGame ? (computerOpponentAvatar || '🤖') : null),
      isComputer: !playerIsWhite ? false : (isComputerGame && !hasSyntheticAvatar)
    };

    const isUserWhite = playerIsWhite;
    const isUserBlack = !playerIsWhite;
    const userPlayer = isUserWhite ? white_player : black_player;
    const opponentPlayer = isUserWhite ? black_player : white_player;

    console.log('GameEndCard player objects created:', {
      white_player_email: white_player.email,
      black_player_email: black_player.email,
      userPlayer_email: userPlayer.email,
      opponentPlayer_email: opponentPlayer.email
    });

    const playersInfo = { white_player, black_player, userPlayer, opponentPlayer, isUserWhite, isUserBlack, hasUser };

    let resultText;
    if (isDraw) {
      resultText = `${userPlayer.name} and ${opponentPlayer.name} drew by ${result.end_reason}`;
    } else {
      // Determine winner and loser names
      let winnerName, loserName;
      if (result.winner_player === 'white') {
        // winner_player explicitly set to 'white'
        winnerName = white_player.name;
        loserName = black_player.name;
      } else if (result.winner_player === 'black') {
        // winner_player explicitly set to 'black'
        winnerName = black_player.name;
        loserName = white_player.name;
      } else if (result.player_color === 'w' && (result.winner === 'player' || result.result?.winner === 'player')) {
        // Player is white and won
        winnerName = white_player.name;
        loserName = black_player.name;
      } else if (result.player_color === 'b' && (result.winner === 'player' || result.result?.winner === 'player')) {
        // Player is black and won
        winnerName = black_player.name;
        loserName = white_player.name;
      } else {
        // Fallback: use isPlayerWin
        winnerName = isPlayerWin ? userPlayer.name : opponentPlayer.name;
        loserName = isPlayerWin ? opponentPlayer.name : userPlayer.name;
      }
      const reasonText = result.end_reason || result.result?.details || 'game completion';
      // Clear, straightforward statement using both names
      resultText = `${winnerName} defeated ${loserName} by ${reasonText}`;
    }

    const icon = isDraw ? "🤝" : (isPlayerWin ? "🏆" : "💔");
    const title = isDraw ? "Draw!" : (isPlayerWin ? "Victory!" : "Defeat");

    // Handle duration calculation with fallbacks
    let gameDurationText = '0m 0s';
    try {
      let durationSeconds = 0;

      // Debug logging to help identify the issue
      console.log('GameEndCard duration calculation:', {
        has_moves: !!result.moves,
        moves_type: typeof result.moves,
        moves_length: Array.isArray(result.moves) ? result.moves.length : 'N/A',
        last_move_at: result.last_move_at,
        created_at: result.created_at,
        played_at: result.played_at,
        ended_at: result.ended_at
      });

      // Method 1: Calculate from moves (sum individual move times, excluding erroneous pause times)
      if (result.moves) {
        let moves = [];
        // Handle different move formats
        if (typeof result.moves === 'string') {
          try {
            // Try to parse if it's a JSON string
            moves = JSON.parse(result.moves);
          } catch {
            // If not JSON, it might be in compact format "e4,2.52;Nf6,0.98;..."
            const moveEntries = result.moves.split(';').filter(entry => entry.trim());
            moveEntries.forEach(entry => {
              const [notation, time] = entry.split(',');
              if (time) {
                const timeValue = parseFloat(time);
                if (!isNaN(timeValue) && timeValue > 0) {
                  moves.push({ time: timeValue });
                }
              }
            });
          }
        } else if (Array.isArray(result.moves)) {
          moves = result.moves;
        }

        // Sum up move times, but exclude any suspiciously large times (likely pause time bugs)
        // Cap individual move times at 60 seconds (1 minute) as moves longer than this
        // likely include pause/away time due to a bug in older game versions
        let totalSeconds = 0;
        let excludedMoves = 0;
        moves.forEach((move) => {
          const moveTime = move.time_spent || move.timeSpent || move.time || 0;
          if (moveTime > 0 && !isNaN(moveTime)) {
            // Exclude moves > 60 seconds as they likely include pause time (bug)
            if (moveTime > 60) {
              console.warn(`Excluding suspiciously long move time: ${moveTime}s (likely includes pause time)`);
              excludedMoves++;
            } else {
              totalSeconds += parseFloat(moveTime);
            }
          }
        });

        durationSeconds = totalSeconds;
        console.log(`Duration from ${moves.length} moves:`, durationSeconds, 'seconds (excluded', excludedMoves, 'moves with pause time bug)');
      }

      // Method 2: Fallback to timestamp differences if no moves data
      if (durationSeconds === 0) {
        if (result.last_move_at && result.created_at) {
          const duration = new Date(result.last_move_at).getTime() - new Date(result.created_at).getTime();
          durationSeconds = Math.round(duration / 1000);
          console.log('Duration from last_move_at - created_at:', durationSeconds, 'seconds');
        } else if (result.played_at && result.ended_at) {
          // Use played_at and ended_at for more accurate duration
          const duration = new Date(result.ended_at).getTime() - new Date(result.played_at).getTime();
          durationSeconds = Math.round(duration / 1000);
          console.log('Duration from ended_at - played_at:', durationSeconds, 'seconds');
        } else if (result.played_at) {
          // Fallback: use current time minus played_at time (but cap at reasonable game duration)
          const duration = Date.now() - new Date(result.played_at).getTime();
          durationSeconds = Math.round(duration / 1000);
          // Cap at 2 hours to avoid showing huge durations for old games
          durationSeconds = Math.min(durationSeconds, 7200);
          console.log('Duration from Date.now() - played_at:', durationSeconds, 'seconds');
        }
      }

      // Ensure we have a valid positive duration and cap at 2 hours
      if (durationSeconds < 0) {
        durationSeconds = 0;
      }
      if (durationSeconds > 7200) {
        durationSeconds = 7200; // Cap at 2 hours
      }

      // Convert seconds to minutes and seconds
      const minutes = Math.floor(durationSeconds / 60);
      const seconds = Math.floor(durationSeconds % 60);
      gameDurationText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
      console.log('Final duration text:', gameDurationText);
    } catch (error) {
      console.error('Error calculating game duration:', error);
      gameDurationText = '0m 0s';
    }

    return { isPlayerWin, isDraw, playersInfo, resultText, icon, title, gameDurationText };
  }, [result, user, score, opponentScore, playerColor, isMultiplayer, computerLevel, isAuthenticated, sharePlayerName]);

  const handleAvatarError = (e, name, color) => {
    // Create a text-based avatar fallback instead of using external service
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Background color based on player color
    const backgroundColor = color === 'white' ? '#4f46e5' : '#1f2937';
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, 128, 128);

    // Add initials
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Get initials from name
    const initials = name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');

    ctx.fillText(initials || 'P', 64, 64);

    // Convert canvas to data URL
    const dataUrl = canvas.toDataURL();
    e.currentTarget.src = dataUrl;
  };

  // Generate avatar URL with fallback
  const getAvatarUrl = (player, color) => {
    // If player is computer, return null to use emoji
    if (player.isComputer) {
      return null;
    }

    // Check multiple avatar field names that might come from backend
    // Priority: avatar_url > avatar > profile_image > photo_url
    const avatarUrl = player.avatar_url || player.avatar || player.profile_image || player.photo_url;

    // Check if avatar URL is valid (not empty, not null, not just whitespace, not emoji)
    if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim() !== '' && !avatarUrl.match(/^\p{Emoji}/u)) {
      // If it's a relative path, make it absolute
      if (avatarUrl.startsWith('/')) {
        return `${window.location.origin}${avatarUrl}`;
      }
      return avatarUrl;
    }

    // Fallback: create a data URL avatar with initials
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Background color based on player color
    const backgroundColor = color === 'white' ? '#4f46e5' : '#1f2937';
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, 128, 128);

    // Add initials
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Get initials from name
    const initials = (player.name || 'Player')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');

    ctx.fillText(initials || 'P', 64, 64);

    // Convert canvas to data URL
    return canvas.toDataURL();
  };

  // Calculate chess game scores: 1.0 for winner, 0.0 for loser, 0.5 for draw
  const calculateGameScore = (isWinner, isDraw) => {
    if (isDraw) return 0.5;
    return isWinner ? 1.0 : 0.0;
  };

  const PlayerCard = ({ player, isCurrentUser, color, score }) => {
    const avatarUrl = getAvatarUrl(player, color);

    // For multiplayer games, use chess scoring if score is 0 or undefined
    // Check using isMultiplayer prop and ensure neither player is a computer
    const isMultiplayerGameCheck = isMultiplayer && !playersInfo.white_player.isComputer && !playersInfo.black_player.isComputer;

    let displayScore = score;
    if (isMultiplayerGameCheck && (score === 0 || score === undefined || score === null)) {
      // Determine if this player is the winner
      const isThisPlayerWhite = color === 'white';

      // Check multiple winner indicators from the result object
      let isThisPlayerWinner = false;
      if (result.winner_player === 'white') {
        isThisPlayerWinner = isThisPlayerWhite;
      } else if (result.winner_player === 'black') {
        isThisPlayerWinner = !isThisPlayerWhite;
      } else if (result.winner_user_id) {
        // Winner determined by user ID
        const thisPlayerId = isThisPlayerWhite ? playersInfo.white_player.id : playersInfo.black_player.id;
        isThisPlayerWinner = result.winner_user_id === thisPlayerId;
      } else {
        // Fallback: check if this card is for the user and the user won
        isThisPlayerWinner = (isCurrentUser && isPlayerWin);
      }

      displayScore = calculateGameScore(isThisPlayerWinner, isDraw);
    }

    return (
      <div className="flex items-center gap-2.5 p-2.5 rounded-xl transition-all duration-300"
      style={{
        backgroundColor: isCurrentUser ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)',
        border: isCurrentUser ? '2px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(4px)'
      }}>
        <div className="relative flex-shrink-0">
          {player.isComputer ? (
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl shadow-lg"
                 style={{ backgroundColor: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.3)' }}>
              🤖
            </div>
          ) : (
            <img
              src={avatarUrl}
              alt={player.name}
              className="w-11 h-11 rounded-full object-cover shadow-lg"
              style={{ border: '2px solid rgba(255,255,255,0.3)' }}
              onError={(e) => handleAvatarError(e, player.name, color === 'white' ? '4f46e5' : '1f2937')}
            />
          )}
          {isCurrentUser && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] shadow-md"
                 style={{ backgroundColor: cardTheme.accent, color: cardTheme.badgeText }}>
              ★
            </div>
          )}
        </div>
      <div className="flex-grow min-w-0">
        <div className="font-bold text-white text-sm truncate">
          {player.name}
          {isCurrentUser && <span className="text-xs font-semibold ml-1" style={{ color: cardTheme.accent }}>(You)</span>}
        </div>
        <div className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Rating: {player.rating}
          {player.is_provisional && <span className="text-yellow-300 font-bold ml-1">?</span>}
        </div>
      </div>
      <div className="text-center flex-shrink-0">
        <div className="text-xl font-extrabold text-white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
          {typeof displayScore === 'number' ? displayScore.toFixed(1) : '0.0'}
        </div>
        <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>Score</div>
      </div>
    </div>
    );
  };

const handleShare = async () => {
  if (!cardRef.current || isSharing) return;

  try {
    setIsSharing(true);
    const cardElement = cardRef.current;

    // Add a temporary class to apply styles specifically for capture
    cardElement.classList.add('share-mode');

    // **CRITICAL FIX**: Wait for all images to fully load first
    await waitForImagesToLoad(cardElement);

    // **FIX:** Convert images to data URLs before capture
    await convertImagesToDataURLs(cardElement);

    // A small delay for the DOM to update with new image sources
    await new Promise(resolve => setTimeout(resolve, 200));

    // Capture the card as canvas with improved configuration
    const canvas = await html2canvas(cardElement, {
      backgroundColor: null, // Use the card's own gradient background
      scale: 2, // Higher quality
      useCORS: true, // Enable CORS for cross-origin images
      allowTaint: false, // Don't allow tainted canvas (required for CORS)
      logging: true, // Enable logging for debugging
      foreignObjectRendering: false, // Disable foreign object rendering for better compatibility
      removeContainer: true, // Remove the temporary container after rendering
      imageTimeout: 15000, // Increase timeout for image loading (15 seconds)
      onclone: (clonedDoc) => {
        console.log('📋 Document cloned in GameEndCard, preparing for capture...');
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

    // Remove the temporary class after capture
    cardElement.classList.remove('share-mode');

    // Convert canvas to blob with medium quality (JPEG format)
    // Using JPEG with 0.8 quality provides good balance between quality and file size
    // This aligns with "Medium" quality setting in Windows share dialog
    const blob = await new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8);
    });

    const file = new File([blob], 'chess-game-result.jpg', { type: 'image/jpeg' });

    // Generate friendly share message
    const opponentName = playersInfo.opponentPlayer?.name || 'opponent';
    const shareText = `${isPlayerWin ? '🏆 I defeated' : isDraw ? '🤝 I drew against' : '♟️ I played against'} ${opponentName} in chess!\n\n🎯 It is fun to play chess at www.chess99.com, Join me! ♟️`;

    // Copy message to clipboard for easy pasting (WhatsApp workaround)
    try {
      await navigator.clipboard.writeText(shareText);
      console.log('Share message copied to clipboard');
    } catch (clipboardError) {
      console.log('Could not copy to clipboard:', clipboardError);
    }

    // ✅ Try mobile native share (works on iOS Safari, Android Chrome)
    // Mobile browsers support both files and text together
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: 'Chess Game Result',
          text: shareText,
          files: [file]
        });
        return; // Success, exit early
      } catch (shareError) {
        if (shareError.name !== 'AbortError') {
          console.error('Error sharing:', shareError);
          // Fall through to show modal as fallback
        } else {
          return; // User cancelled, exit
        }
      }
    }

    // Fallback: Show modal for browsers without native share or if share failed
    const imageUrl = URL.createObjectURL(blob);
    setShareImageUrl(imageUrl);
    setShowShareModal(true);
  } catch (error) {
    console.error('Error preparing share:', error);
    alert('Failed to prepare share. Please try again.');
    const cardElement = cardRef.current;
    if (cardElement) cardElement.classList.remove('share-mode');
  } finally {
    setIsSharing(false);
  }
};

  const handleDownload = () => {
    if (!shareImageUrl) return;

    const link = document.createElement('a');
    link.href = shareImageUrl;
    link.download = `chess-game-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSocialShare = (platform) => {
    const shareText = `${resultText} - Play chess at Chess99.com`;
    const url = SHARE_URLS[platform](shareText);
    window.open(url, '_blank', 'width=600,height=400');
  };

  const handleNativeShare = async () => {
    if (!shareImageUrl) return;

    try {
      const response = await fetch(shareImageUrl);
      const blob = await response.blob();
      const file = new File([blob], 'chess-game-result.jpg', { type: 'image/jpeg' });

      // Generate friendly share message
      const opponentName = playersInfo.opponentPlayer?.name || 'opponent';
      const shareText = `${isPlayerWin ? '🏆 I defeated' : isDraw ? '🤝 I drew against' : '♟️ I played against'} ${opponentName} in chess!\n\n🎯 It is fun to play chess at www.chess99.com, Join me! ♟️`;

      // Copy message to clipboard for easy pasting (WhatsApp workaround)
      try {
        await navigator.clipboard.writeText(shareText);
        console.log('Share message copied to clipboard');
      } catch (clipboardError) {
        console.log('Could not copy to clipboard:', clipboardError);
      }

      // ✅ Try mobile native share (works on iOS Safari, Android Chrome)
      // Mobile browsers support both files and text together
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Chess Game Result',
          text: shareText,
          files: [file]
        });
        return;
      }

      // 💻 Desktop fallback
      // WhatsApp Desktop/Web can't receive both image and text from web share
      // So we open WhatsApp with text and auto-download the image
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (!isMobile) {
        // For desktop browsers: Open WhatsApp Web with text + auto-download image
        const encodedText = encodeURIComponent(shareText);
        const whatsappUrl = `https://wa.me/?text=${encodedText}`;

        // Open WhatsApp in new tab
        window.open(whatsappUrl, '_blank');

        // Auto-download the image
        const link = document.createElement('a');
        link.href = shareImageUrl;
        link.download = 'chess-game-result.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Show helpful message
        setTimeout(() => {
          alert('✅ WhatsApp opened!\n\n📋 Message copied to clipboard - paste it in WhatsApp\n💾 Image downloaded - attach it to your message');
        }, 500);
      } else {
        // Mobile without native share support - just download
        alert('Your browser doesn\'t support direct sharing. The image will be downloaded to your device.');
        const link = document.createElement('a');
        link.href = shareImageUrl;
        link.download = 'chess-game-result.jpg';
        link.click();
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error sharing:', error);
        alert('Failed to share. Please try downloading the image instead.');
      }
    }
  };

  const closeShareModal = () => {
    setShowShareModal(false);
    if (shareImageUrl) {
      URL.revokeObjectURL(shareImageUrl);
      setShareImageUrl(null);
    }
  };

  // Vibrant color themes based on result
  const cardTheme = isPlayerWin
    ? { bg: 'linear-gradient(145deg, #1a5c1a 0%, #2d8a2d 40%, #3da53d 100%)', accent: '#FFD700', text: '#fff', sub: 'rgba(255,255,255,0.8)', badge: '#FFD700', badgeText: '#1a5c1a' }
    : isDraw
    ? { bg: 'linear-gradient(145deg, #7a5a00 0%, #b8860b 40%, #d4a017 100%)', accent: '#FFF8DC', text: '#fff', sub: 'rgba(255,255,255,0.8)', badge: '#FFF8DC', badgeText: '#7a5a00' }
    : { bg: 'linear-gradient(145deg, #2d1b69 0%, #4a2d8a 40%, #6b3fa0 100%)', accent: '#E0B0FF', text: '#fff', sub: 'rgba(255,255,255,0.8)', badge: '#E0B0FF', badgeText: '#2d1b69' };

  return (
    <div
         ref={cardRef}
         className={`game-end-card w-full mx-auto rounded-3xl shadow-2xl overflow-hidden relative ${className}`}
         style={{
           background: cardTheme.bg,
           maxWidth: window.innerWidth <= 480 ? '95vw' : '480px',
           border: '2px solid rgba(255,255,255,0.15)'
         }}>

      {/* Decorative floating shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}></div>
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }}></div>
        <div className="absolute top-1/2 right-4 w-16 h-16 rounded-full" style={{ background: 'rgba(255,255,255,0.03)' }}></div>
      </div>

      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 rounded-full w-8 h-8 flex items-center justify-center transition-all duration-200 hover:scale-110"
          aria-label="Close game end card"
          style={{
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.8)',
            border: '1px solid rgba(255,255,255,0.2)'
          }}
        >
          <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      )}

      {/* Main content */}
      <div className="relative z-10 p-4 pb-3">
        {/* Chess99 brand header */}
        <div className="text-center mb-2">
          <span className="text-xl" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>♛</span>
          <span className="text-2xl font-extrabold tracking-tight ml-1" style={{
            background: 'linear-gradient(135deg, #FFD700, #FFA500)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.02em',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))'
          }}>
            Chess99.com
          </span>
        </div>

        {/* Header badge */}
        <div className="text-center mb-2">
          {championshipData ? (
            <div className="space-y-1">
              <div className="inline-block bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 px-5 py-1.5 rounded-full font-bold text-xs shadow-lg">
                🏆 {championshipData.tournamentName}
              </div>
              <div style={{ color: cardTheme.sub }} className="font-semibold text-xs">
                Round {championshipData.round} {championshipData.matchId ? `• Match #${championshipData.matchId}` : ''}
              </div>
            </div>
          ) : (
            <div className="inline-block px-4 py-1 rounded-full font-bold text-xs shadow-sm"
                 style={{ backgroundColor: cardTheme.badge, color: cardTheme.badgeText }}>
              {isMultiplayer ? '⚔️ Multiplayer Match' : (result.opponent_name ? `♟️ vs ${result.opponent_name}` : `🤖 Computer Level ${computerLevel || 8}`)}
            </div>
          )}
        </div>

        {/* Result display — big icon and title */}
        <div className="text-center mb-3">
          <div className="text-5xl mb-1" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }}>
            {icon}
          </div>
          <h1 className="text-3xl font-extrabold mb-1 tracking-tight" style={{ color: cardTheme.accent, textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
            {title}
          </h1>
          <p className="text-xs max-w-xs mx-auto" style={{ color: cardTheme.sub }}>
            {resultText}
          </p>
        </div>

        {/* Players section */}
        <div className="space-y-1.5 mb-3">
          {(() => {
            // FIX: Determine who is "You" based on victory/defeat, not just color assignment
            // Determine who the winner is (white or black)
            let whiteIsWinner = false;
            if (result.winner_player === 'white') {
              whiteIsWinner = true;
            } else if (result.winner_player === 'black') {
              whiteIsWinner = false;
            } else if (result.player_color === 'w' && (result.winner === 'player' || result.result?.winner === 'player')) {
              // Player is white and won
              whiteIsWinner = true;
            } else if (result.player_color === 'b' && (result.winner === 'player' || result.result?.winner === 'player')) {
              // Player is black and won
              whiteIsWinner = false;
            } else {
              // Fallback: use isPlayerWin and playerColor
              // If isPlayerWin, then current user (userPlayer) is the winner
              // userPlayer is white if isUserWhite, so whiteIsWinner = isPlayerWin && isUserWhite
              whiteIsWinner = isPlayerWin ? playersInfo.isUserWhite : playersInfo.isUserBlack;
            }

            // Determine who is "You" based on victory/defeat
            // If Victory (isPlayerWin), current user is the winner
            // If Defeat (!isPlayerWin), current user is the loser
            let whiteIsCurrentUser, blackIsCurrentUser;
            if (isDraw) {
              // In a draw, both players could be "You" if it's a local game
              // But typically, use the original color-based logic
              whiteIsCurrentUser = playersInfo.hasUser && playersInfo.isUserWhite;
              blackIsCurrentUser = playersInfo.hasUser && playersInfo.isUserBlack;
            } else {
              if (isPlayerWin) {
                // Victory: current user is the winner
                whiteIsCurrentUser = playersInfo.hasUser && whiteIsWinner;
                blackIsCurrentUser = playersInfo.hasUser && !whiteIsWinner;
              } else {
                // Defeat: current user is the loser
                whiteIsCurrentUser = playersInfo.hasUser && !whiteIsWinner;
                blackIsCurrentUser = playersInfo.hasUser && whiteIsWinner;
              }
            }

            return (
              <>
                <PlayerCard
                  player={playersInfo.white_player}
                  isCurrentUser={whiteIsCurrentUser}
                  color="white"
                  score={playersInfo.isUserWhite ? (score !== undefined ? score : (result.final_score || result.finalScore || 0)) : (opponentScore !== undefined ? opponentScore : (result.opponent_score || 0))}
                />

                <div className="text-center -my-0.5">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-full font-extrabold text-xs shadow-md"
                       style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', border: '2px solid rgba(255,255,255,0.3)' }}>
                    VS
                  </div>
                </div>

                <PlayerCard
                  player={playersInfo.black_player}
                  isCurrentUser={blackIsCurrentUser}
                  color="black"
                  score={playersInfo.isUserBlack ? (score !== undefined ? score : (result.final_score || result.finalScore || 0)) : (opponentScore !== undefined ? opponentScore : (result.opponent_score || 0))}
                />
              </>
            );
          })()}
        </div>


        {/* Rating update */}
        {ratingUpdate && !ratingUpdate.isLoading && !ratingUpdate.error && ratingUpdate.newRating !== null && (
          <div className="p-2.5 rounded-xl text-center mb-3" style={{ backgroundColor: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }}>
            <div className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>Rating Update</div>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="line-through text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{ratingUpdate.oldRating}</span>
              <span className={`text-lg font-extrabold ${ratingUpdate.ratingChange >= 0 ? '' : ''}`}
                    style={{ color: ratingUpdate.ratingChange >= 0 ? '#7CFC00' : '#FF6B6B' }}>
                {ratingUpdate.ratingChange >= 0 ? '▲' : '▼'} {Math.abs(ratingUpdate.ratingChange)}
              </span>
              <span className="text-2xl font-extrabold text-white" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.3)' }}>{ratingUpdate.newRating}</span>
            </div>
          </div>
        )}

        {/* Championship Standing/Points - show if championship data available */}
        {championshipData && (championshipData.standing || championshipData.points !== undefined) && (
          <div className="p-2.5 rounded-xl text-center mb-3" style={{ backgroundColor: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Championship Progress</div>
            <div className="flex items-center justify-center gap-6">
              {championshipData.standing && (
                <div className="text-center">
                  <div className="text-[10px] font-bold uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>Standing</div>
                  <div className="text-xl font-extrabold text-yellow-300">{championshipData.standing}</div>
                </div>
              )}
              {championshipData.points !== undefined && (
                <div className="text-center">
                  <div className="text-[10px] font-bold uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>Points</div>
                  <div className="text-xl font-extrabold text-yellow-300">{championshipData.points}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer branding */}
        <div className="text-center pt-2 mt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="text-[11px] font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>
            ♟️ chess99.com
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '20px',
            overflowY: 'auto' // Allow scrolling if content overflows
          }}
          onClick={closeShareModal}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '20px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh', // Limit height to viewport
              overflowY: 'auto', // Make content scrollable
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
              margin: 'auto' // Center vertically when scrolling
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#81b64c', marginBottom: '10px' }}>
                Share Your Game Result
              </h2>
              <p style={{ color: '#6B7280', fontSize: '14px' }}>
                Share your achievement with WhatsApp, Facebook, and more!
              </p>
            </div>

            {/* Share preview - smaller size */}
            {shareImageUrl && (
              <div style={{
                marginBottom: '20px',
                borderRadius: '10px',
                overflow: 'hidden',
                border: '2px solid #E5E7EB',
                maxHeight: '200px' // Limit preview height
              }}>
                <img
                  src={shareImageUrl}
                  alt="Share preview"
                  style={{
                    width: '100%',
                    height: 'auto',
                    maxHeight: '200px',
                    objectFit: 'cover',
                    display: 'block'
                  }}
                />
              </div>
            )}

            {/* Share options - Native share button prominently displayed */}
            {navigator.share ? (
              <button
                onClick={handleNativeShare}
                style={{
                  width: '100%',
                  padding: '18px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: '#81b64c',
                  color: 'white',
                  fontSize: '18px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  marginBottom: '15px',
                  boxShadow: '0 4px 12px rgba(129, 182, 76, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#4e7837';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(129, 182, 76, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#81b64c';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(129, 182, 76, 0.3)';
                }}
              >
                <span style={{ fontSize: '28px' }}>🔗</span>
                <span>Share Your Achievement</span>
              </button>
            ) : (
              /* Fallback for browsers without share API */
              <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                <button
                  onClick={handleDownload}
                  style={{
                    width: '100%',
                    padding: '18px',
                    borderRadius: '12px',
                    border: 'none',
                    backgroundColor: '#81b64c',
                    color: 'white',
                    fontSize: '18px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: '0 4px 12px rgba(129, 182, 76, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#4e7837';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(129, 182, 76, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#81b64c';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(129, 182, 76, 0.3)';
                  }}
                >
                  <span style={{ fontSize: '28px' }}>💾</span>
                  <span>Download Image</span>
                </button>
                <p style={{
                  color: '#6B7280',
                  fontSize: '13px',
                  marginTop: '10px',
                  lineHeight: '1.4'
                }}>
                  Download the image and share it with your friends!
                </p>
              </div>
            )}

            {/* Close button */}
            <button
              onClick={(e) => { e.stopPropagation(); closeShareModal(); }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: '#F3F4F6',
                color: '#6B7280',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#E5E7EB';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#F3F4F6';
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

GameEndCard.displayName = 'GameEndCard';

export default GameEndCard;
