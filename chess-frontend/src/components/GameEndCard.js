import React, { useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import chessPlayingKids from '../assets/images/chess-playing-kids-crop.png';
import logo from '../assets/images/logo.png';
import './GameEndCard.css';

// Social share URLs - Note: These platforms don't support direct image URLs in share parameters
// Images are only supported via Web Share API (navigator.share with files) on mobile devices
const SHARE_URLS = {
  whatsapp: (text) => `https://wa.me/?text=${encodeURIComponent(text)}`,
  facebook: (text) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://chess99.com')}`,
  twitter: (text) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent('https://chess99.com')}`,
  linkedin: (text) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://chess99.com')}`
};

// Helper function to convert all images within an element to data URLs
// This robustly handles image loading for html2canvas capture.
const convertImagesToDataURLs = async (element) => {
  // Handle <img> tags
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map(async (img) => {
      // Don't re-convert if it's already a data URL
      if (img.src.startsWith('data:')) return;

      try {
        const response = await fetch(img.src, { mode: 'cors' });
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

  // Handle CSS background-image properties (for backgrounds, etc.)
  const allElements = Array.from(element.querySelectorAll('*'));
  allElements.push(element); // Include the root element itself

  await Promise.all(
    allElements.map(async (el) => {
      const bgImage = window.getComputedStyle(el).backgroundImage;

      // Check if there's a background-image and it's a URL (not 'none' or gradient)
      if (bgImage && bgImage !== 'none' && bgImage.includes('url(')) {
        // Extract URL from background-image (handles multiple backgrounds)
        const urlMatches = bgImage.match(/url\(["']?([^"')]+)["']?\)/g);

        if (urlMatches) {
          for (const urlMatch of urlMatches) {
            const url = urlMatch.match(/url\(["']?([^"')]+)["']?\)/)[1];

            // Skip if already a data URL
            if (url.startsWith('data:')) continue;

            try {
              const response = await fetch(url, { mode: 'cors' });
              if (!response.ok) {
                throw new Error(`Failed to fetch background image: ${response.status} ${response.statusText}`);
              }
              const blob = await response.blob();
              const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });

              // Replace the URL in the background-image with the data URL
              const newBgImage = bgImage.replace(url, dataUrl);
              el.style.backgroundImage = newBgImage;
            } catch (error) {
              console.error(`Could not convert background image ${url} to data URL:`, error);
              // We continue even if one image fails
            }
          }
        }
      }
    })
  );
};

// SVG Chess Piece Components (similar to Background.js)
const ChessKing = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C11.45 2 11 2.45 11 3V4H10C9.45 4 9 4.45 9 5S9.45 6 10 6H11V7C10.45 7 10 7.45 10 8S10.45 9 11 9H13C13.55 9 14 8.55 14 8S13.55 7 13 7V6H14C14.55 6 15 5.55 15 5S14.55 4 14 4H13V3C13 2.45 12.55 2 12 2M7.5 10C6.67 10 6 10.67 6 11.5V12.5C6 13.33 6.67 14 7.5 14H8.5L9 20H15L15.5 14H16.5C17.33 14 18 13.33 18 12.5V11.5C18 10.67 17.33 10 16.5 10H7.5Z"/>
  </svg>
);

const ChessQueen = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 14L3 15V16L4 17H20L21 16V15L20 14L18.5 7L17 6H16L14.5 7.5L12 5L9.5 7.5L8 6H7L5.5 7L4 14M6 16L7 10H8L9.5 11.5L12 9L14.5 11.5L16 10H17L18 16H6Z"/>
  </svg>
);

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
  isAuthenticated
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
      blackPlayerAvatar: result.black_player?.avatar
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

    const isDraw = result.result === '1/2-1/2' || result.end_reason === 'draw' || result.result?.status === 'draw';

    // Handle cases where white_player and black_player might not exist
    // For computer games: use !isMultiplayer as primary check, with result.game_mode as fallback
    const isComputerGame = !isMultiplayer || result.game_mode === 'computer' || result.game_mode === 'local_ai';
    const playerIsWhite = result.player_color === 'w';

    // Use the provided computerLevel if available, otherwise fall back to result.computer_level
    const effectiveComputerLevel = computerLevel !== undefined ? computerLevel : result.computer_level;

    console.log('Player assignment debug:', {
      isComputerGame,
      playerIsWhite,
      computerLevel,
      effectiveComputerLevel,
      userName: user?.name,
      opponentName: result.opponent_name
    });

    const white_player = result.white_player || {
      id: playerIsWhite ? result.user_id : null,
      name: playerIsWhite ? (user?.name || 'Player') : (isComputerGame ? `Computer Level ${effectiveComputerLevel || 8}` : (result.opponent_name || 'Opponent')),
      rating: playerIsWhite ? (user?.rating || 1200) : (isComputerGame ? (effectiveComputerLevel ? 1000 + (effectiveComputerLevel * 100) : 1800) : 1200),
      is_provisional: playerIsWhite ? (user?.is_provisional || false) : false,
      // Check multiple avatar field names from backend
      avatar_url: playerIsWhite ? (user?.avatar_url || user?.avatar) : (isComputerGame ? '🤖' : (result.white_player?.avatar || result.white_player?.avatar_url || null)),
      avatar: playerIsWhite ? (user?.avatar || user?.avatar_url) : (isComputerGame ? '🤖' : (result.white_player?.avatar || result.white_player?.avatar_url || null)),
      isComputer: playerIsWhite ? false : isComputerGame
    };

    const black_player = result.black_player || {
      id: !playerIsWhite ? result.user_id : null,
      name: !playerIsWhite ? (user?.name || 'Player') : (isComputerGame ? `Computer Level ${effectiveComputerLevel || 8}` : (result.opponent_name || 'Opponent')),
      rating: !playerIsWhite ? (user?.rating || 1200) : (isComputerGame ? (effectiveComputerLevel ? 1000 + (effectiveComputerLevel * 100) : 1800) : 1200),
      is_provisional: !playerIsWhite ? (user?.is_provisional || false) : false,
      // Check multiple avatar field names from backend
      avatar_url: !playerIsWhite ? (user?.avatar_url || user?.avatar) : (isComputerGame ? '🤖' : (result.black_player?.avatar || result.black_player?.avatar_url || null)),
      avatar: !playerIsWhite ? (user?.avatar || user?.avatar_url) : (isComputerGame ? '🤖' : (result.black_player?.avatar || result.black_player?.avatar_url || null)),
      isComputer: !playerIsWhite ? false : isComputerGame
    };

    const isUserWhite = playerIsWhite;
    const isUserBlack = !playerIsWhite;
    const userPlayer = isUserWhite ? white_player : black_player;
    const opponentPlayer = isUserWhite ? black_player : white_player;

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
  }, [result, user, score, opponentScore, playerColor, isMultiplayer, computerLevel, isAuthenticated]);

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

    // Check if avatar URL is valid (not empty, not null, not just whitespace)
    if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim() !== '') {
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
    // Check if this is a multiplayer game by seeing if both players have IDs
    const isMultiplayerGame = playersInfo.white_player.id && playersInfo.black_player.id && !playersInfo.white_player.isComputer && !playersInfo.black_player.isComputer;

    let displayScore = score;
    if (isMultiplayerGame && (score === 0 || score === undefined)) {
      // Determine if this player is the winner
      const isThisPlayerWhite = color === 'white';
      const isThisPlayerWinner = (result.winner_player === 'white' && isThisPlayerWhite) ||
                                  (result.winner_player === 'black' && !isThisPlayerWhite) ||
                                  (isUserWhite === isThisPlayerWhite && isPlayerWin);
      displayScore = calculateGameScore(isThisPlayerWinner, isDraw);
    }

    return (
      <div className={`flex items-center gap-2 p-2 rounded-xl shadow-md transition-all duration-300 ${
        isCurrentUser
          ? 'bg-gradient-to-r from-sky-50 to-blue-50 border-2 border-sky-300'
          : 'bg-white border-2 border-gray-200'
      }`}>
        <div className="relative flex-shrink-0">
          {player.isComputer ? (
            // Computer avatar - show emoji with modern styling
            <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center text-2xl bg-gradient-to-br from-gray-100 to-gray-200 shadow-lg"
                 style={{ borderColor: color === 'white' ? '#E5E7EB' : '#4B5563' }}>
              🤖
            </div>
          ) : (
            // Human avatar - show image with better styling
            <img
              src={avatarUrl}
              alt={player.name}
              className="w-12 h-12 rounded-full border-2 object-cover shadow-lg"
              style={{ borderColor: color === 'white' ? '#E5E7EB' : '#4B5563' }}
              onError={(e) => handleAvatarError(e, player.name, color === 'white' ? '4f46e5' : '1f2937')}
            />
          )}
          <div className={`absolute -bottom-0.5 -right-0.5 text-xl shadow-md ${
            color === 'white' ? 'text-gray-700' : 'text-gray-900'
          }`}>
            {color === 'white' ? <ChessKing className="w-5 h-5" /> : <ChessKing className="w-5 h-5" />}
          </div>
        </div>
      <div className="flex-grow">
        <div className="font-bold text-gray-800 text-base mb-0.5">
          {player.name}
          {isCurrentUser && <span className="text-xs font-medium text-sky-600 ml-1">(You)</span>}
        </div>
        <div className="text-sm text-gray-600 font-medium">
          Rating: {player.rating}
          {player.is_provisional && <span className="text-yellow-500 font-bold ml-1">?</span>}
        </div>
        {isCurrentUser && (
          <div className="text-xs text-sky-600 font-medium mt-0.5">
            {isPlayerWin ? '🏆 Winner' : isDraw ? '🤝 Draw' : '💪 Good Game'}
          </div>
        )}
      </div>
      <div className="text-center">
        <div className="text-xl font-bold text-gray-800">
          {typeof displayScore === 'number' ? displayScore.toFixed(1) : '0.0'}
        </div>
        <div className="text-xs text-gray-500 uppercase tracking-wide">Score</div>
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

      // **FIX:** Convert images to data URLs before capture
      await convertImagesToDataURLs(cardElement);

      // A small delay for the DOM to update with new image sources
      await new Promise(resolve => setTimeout(resolve, 200));

      // Capture the card as canvas with improved configuration
      const canvas = await html2canvas(cardElement, {
        backgroundColor: '#ffffff',
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

  return (
    <div
         ref={cardRef}
         className={`game-end-card w-full mx-auto rounded-3xl shadow-2xl overflow-hidden relative bg-white ${className}`}
         style={{
           backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.6)), url(${chessPlayingKids})`,
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundRepeat: 'no-repeat',
           maxWidth: window.innerWidth <= 480 ? '95vw' : '640px' // Responsive max-width
         }}>
      {/* Additional gradient overlay for better readability */}
      <div className="absolute inset-0 bg-gradient-to-br from-sky-50/20 via-white/30 to-blue-50/20"></div>

      {/* Decorative chess board pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="grid grid-cols-8 grid-rows-8 h-full">
          {Array.from({ length: 64 }, (_, i) => (
            <div
              key={i}
              style={{
                backgroundColor: (Math.floor(i / 8) + i) % 2 === 0 ? '#0284C7' : 'transparent'
              }}
            />
          ))}
        </div>
      </div>

      {/* Floating chess pieces decoration */}
      <div className="absolute top-2 left-2 text-sky-200 opacity-30">
        <ChessKing className="w-8 h-8" />
      </div>
      <div className="absolute top-2 right-2 text-sky-200 opacity-30">
        <ChessQueen className="w-8 h-8" />
      </div>
      <div className="absolute bottom-2 left-2 text-sky-200 opacity-30">
        <ChessKing className="w-6 h-6" />
      </div>
      <div className="absolute bottom-2 right-2 text-sky-200 opacity-30">
        <ChessQueen className="w-6 h-6" />
      </div>

      {/* Main content */}
      <div className="relative z-10 p-4">
        {/* Header with logo - blue background bar for visibility */}
        <div className="text-center mb-3">
          <div className="inline-block bg-sky-600/90 px-6 py-2 rounded-full mb-2">
            {/* Use inline backgroundImage style for html2canvas compatibility - same approach as chess background */}
            {/* <div
              style={{
                backgroundImage: `url(${logo})`,
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                width: '120px',
                height: '32px'
              }}
              role="img"
              aria-label="Chess99 Logo"
            /> */}
            <div className="inline-block bg-sky-600 text-white px-4 py-1 rounded-full font-semibold text-xs">Chess99.com</div>
          </div>
          <div className="inline-block bg-sky-600 text-white px-4 py-1 rounded-full font-semibold text-xs">
            {isMultiplayer ? 'Multiplayer Match' : `Computer Level ${computerLevel || 8}`}
          </div>
        </div>

        {/* Result display */}
        <div className="text-center mb-4">
          <h1 className={`text-2xl md:text-3xl font-extrabold mb-2 ${
            isPlayerWin ? "text-sky-600" : isDraw ? "text-gray-600" : "text-gray-500"
          }`}>
            CHESS GAME RESULT
          </h1>
          <div className={`text-5xl mb-2 ${isPlayerWin ? "text-yellow-500" : isDraw ? "text-gray-500" : "text-gray-400"}`}>
            {icon}
          </div>
          <h1 className={`text-2xl md:text-3xl font-extrabold mb-2 ${
            isPlayerWin ? "text-sky-600" : isDraw ? "text-gray-600" : "text-gray-500"
          }`}>
            {title}
          </h1>
          <p className="text-sm md:text-base text-gray-600 max-w-2xl mx-auto">
            {resultText}
          </p>
        </div>

        {/* Players section */}
        <div className="space-y-2 mb-4">
          <PlayerCard
            player={playersInfo.white_player}
            isCurrentUser={playersInfo.hasUser && playersInfo.isUserWhite}
            color="white"
            score={playersInfo.isUserWhite ? (score !== undefined ? score : (result.final_score || result.finalScore || 0)) : (opponentScore !== undefined ? opponentScore : (result.opponent_score || 0))}
          />

          <div className="text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-sky-100 text-sky-600 font-bold text-lg shadow-md">
              VS
            </div>
          </div>

          <PlayerCard
            player={playersInfo.black_player}
            isCurrentUser={playersInfo.hasUser && playersInfo.isUserBlack}
            color="black"
            score={playersInfo.isUserBlack ? (score !== undefined ? score : (result.final_score || result.finalScore || 0)) : (opponentScore !== undefined ? opponentScore : (result.opponent_score || 0))}
          />
        </div>


        {/* Rating update */}
        {ratingUpdate && !ratingUpdate.isLoading && !ratingUpdate.error && ratingUpdate.newRating !== null && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-2 rounded-xl border-2 border-yellow-300 text-center mb-4">
            <div className="text-sm font-semibold text-gray-700">Rating Update</div>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="text-gray-500 line-through text-sm">{ratingUpdate.oldRating}</span>
              <span className={`text-xl font-bold ${ratingUpdate.ratingChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {ratingUpdate.ratingChange >= 0 ? '↑' : '↓'} {Math.abs(ratingUpdate.ratingChange)}
              </span>
              <span className="text-2xl font-bold text-gray-800">{ratingUpdate.newRating}</span>
            </div>
          </div>
        )}

        {/* Call to action */}
        <div className="text-center mb-3">
          <div className="bg-gradient-to-r from-sky-500 to-blue-600 text-white p-3 rounded-xl shadow-lg">
            <div className="text-lg font-bold mb-1">
              ♟️ Want to Play With Me?
            </div>
            <div className="text-sm mb-2">
              Think you can beat me? Join and challenge me!
              
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div className="text-xs font-medium">Register and play at</div>
              <a href="https://www.chess99.com" target="_blank" rel="noopener noreferrer" className="bg-white text-sky-600 px-3 py-1.5 rounded-lg font-bold hover:bg-sky-50 transition-colors text-base">
                Chess99.com
              </a>
            </div>
          </div>
        </div>

        {/* Share button - only show for non-multiplayer games */}
        {!isMultiplayer && (
          <div className="text-center mb-3">
            <button
              onClick={handleShare}
              disabled={isSharing}
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-2 rounded-xl shadow-lg font-bold text-sm hover:from-green-600 hover:to-emerald-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
            >
              {isSharing ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Preparing...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  <span>Share Game Result</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Footer branding */}
        <div className="text-center pt-3 border-t border-gray-200">
          <div className="text-gray-500 text-xs">
            India's Best Chess Site for Kids • Making Chess Fun! 🎯
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
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0284C7', marginBottom: '10px' }}>
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
                  backgroundColor: '#0284C7',
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
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#0369A1';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(2, 132, 199, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#0284C7';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(2, 132, 199, 0.3)';
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
                    backgroundColor: '#0284C7',
                    color: 'white',
                    fontSize: '18px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#0369A1';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(2, 132, 199, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#0284C7';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(2, 132, 199, 0.3)';
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
              onClick={closeShareModal}
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
