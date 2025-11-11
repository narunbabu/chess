import React, { useState, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getGameHistoryById } from "../services/gameHistoryService";
import api from "../services/api";
import GameEndCard from "./GameEndCard";
import { getGameResultShareMessage, getShareableGameUrl } from "../utils/socialShareUtils";
import { isWin, isDraw } from "../utils/resultStandardization";
import { useAuth } from "../contexts/AuthContext";
import { uploadGameResultImage } from "../services/sharedResultService";

// Helper function to convert all images within an element to data URLs
// This robustly handles image loading for html2canvas capture.
const convertImagesToDataURLs = async (element) => {
  console.log('🔄 Converting images to data URLs...');

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
        const response = await fetch(img.src, { mode: 'cors', credentials: 'same-origin' });
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
              const response = await fetch(url, { mode: 'cors', credentials: 'same-origin' });
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


const GameReview = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { id: gameId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const [gameHistory, setGameHistory] = useState({ moves: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [game, setGame] = useState(new Chess());
  const timerRef = useRef(null);
  const boardBoxRef = useRef(null);
  const [boardSize, setBoardSize] = useState(400);
  const [searchParams] = useSearchParams();
  const [showEndCard, setShowEndCard] = useState(false);
  const [isTestSharing, setIsTestSharing] = useState(false);

  // Load game data when component mounts or gameId changes
  useEffect(() => {
    const loadGameData = async () => {
      let effectiveGameId = gameId;

      // If no gameId in URL, try to get from location state or localStorage
      if (!effectiveGameId) {
        let history = location.state?.gameHistory;
        if (!history) {
          const stored = localStorage.getItem('lastGameHistory');
          history = stored ? JSON.parse(stored) : null;
        }
        
        if (history) {
          setGameHistory(history);
          setLoading(false);
          return;
        } else {
          // If still no history, set an error or default state
          setError('No game specified');
          setGameHistory({ moves: [] });
          setLoading(false);
          return;
        }
      }

      try {
        setLoading(true);
        setError(null);

        const mode = searchParams.get('mode');

        let gameData;
        let isMultiplayer = mode === 'multiplayer';

        if (isMultiplayer) {
          // For multiplayer, fetch from games API to get correct quality scores
          const response = await api.get(`/games/${effectiveGameId}`);
          gameData = response.data;

          if (!gameData) {
            setError('Game not found');
            setGameHistory({ moves: [] });
            setLoading(false);
            return;
          }

          // Map game data to history format
          const playerColor = gameData.player_color;
          const formattedGameHistory = {
            id: gameData.id,
            played_at: gameData.ended_at || new Date().toISOString(),
            player_color: playerColor,
            game_mode: 'multiplayer',
            opponent_name: playerColor === 'w' ? gameData.black_player?.name : gameData.white_player?.name,
            moves: gameData.moves,
            final_score: playerColor === 'w' ? parseFloat(gameData.white_player_score || 0) : parseFloat(gameData.black_player_score || 0),
            opponent_score: playerColor === 'w' ? parseFloat(gameData.black_player_score || 0) : parseFloat(gameData.white_player_score || 0),
            result: {
              details: gameData.end_reason,
              end_reason: gameData.end_reason,
              status: gameData.result
            },
            white_time_remaining_ms: gameData.white_time_remaining_ms,
            black_time_remaining_ms: gameData.black_time_remaining_ms,
            // Add other fields as needed
            computer_level: 0
          };

          // Handle moves conversion from different formats (reuse existing logic)
          let convertedMoves = [{ move: { san: 'Start' }, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' }];

          if (typeof gameData.moves === 'string') {
            // Parse string format: "e4,2.52;Nf6,0.98;..."
            console.log("Converting string moves format for multiplayer:", gameData.moves.substring(0, 50) + "...");
            const tempGame = new Chess();

            gameData.moves.split(';').forEach(moveStr => {
              const [notation, time] = moveStr.split(',');
              if (notation && notation.trim()) {
                try {
                  const move = tempGame.move(notation.trim());
                  if (move) {
                    convertedMoves.push({
                      move: { san: move.san },
                      fen: tempGame.fen(),
                      time: parseFloat(time) || undefined
                    });
                  }
                } catch (moveError) {
                  console.error('Error processing move:', notation, moveError);
                }
              }
            });
            formattedGameHistory.moves = convertedMoves;
          } else if (Array.isArray(gameData.moves) && gameData.moves.length > 0 && gameData.moves[0].notation) {
            // Convert from API format [{notation: "e4", time: 2.5}]
            console.log("Converting API moves format for multiplayer...");
            const tempGame = new Chess();

            gameData.moves.forEach(moveData => {
              try {
                const move = tempGame.move(moveData.notation);
                if (move) {
                  convertedMoves.push({
                    move: { san: move.san },
                    fen: tempGame.fen(),
                    time: moveData.time
                  });
                }
              } catch (moveError) {
                console.error('Error processing move:', moveData.notation, moveError);
              }
            });
            formattedGameHistory.moves = convertedMoves;
          } else if (!Array.isArray(gameData.moves)) {
              formattedGameHistory.moves = convertedMoves; // Just have the start move
          } else {
            // Already in correct format
            formattedGameHistory.moves = gameData.moves;
          }

          setGameHistory(formattedGameHistory);
        } else {
          // For non-multiplayer, use existing history fetch
          gameData = await getGameHistoryById(effectiveGameId);

          if (!gameData) {
            setError('Game not found');
            setGameHistory({ moves: [] });
            setLoading(false); // Stop loading even if not found
            return;
          }

          let formattedGameHistory = { ...gameData };

          // Handle moves conversion from different formats
          let convertedMoves = [{ move: { san: 'Start' }, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' }];

          if (typeof gameData.moves === 'string') {
            // Parse string format: "e4,2.52;Nf6,0.98;..."
            console.log("Converting string moves format:", gameData.moves.substring(0, 50) + "...");
            const tempGame = new Chess();

            gameData.moves.split(';').forEach(moveStr => {
              const [notation, time] = moveStr.split(',');
              if (notation && notation.trim()) {
                try {
                  const move = tempGame.move(notation.trim());
                  if (move) {
                    convertedMoves.push({
                      move: { san: move.san },
                      fen: tempGame.fen(),
                      time: parseFloat(time) || undefined
                    });
                  }
                } catch (moveError) {
                  console.error('Error processing move:', notation, moveError);
                }
              }
            });
            formattedGameHistory.moves = convertedMoves;
          } else if (Array.isArray(gameData.moves) && gameData.moves.length > 0 && gameData.moves[0].notation) {
            // Convert from API format [{notation: "e4", time: 2.5}]
            console.log("Converting API moves format...");
            const tempGame = new Chess();

            gameData.moves.forEach(moveData => {
              try {
                const move = tempGame.move(moveData.notation);
                if (move) {
                  convertedMoves.push({
                    move: { san: move.san },
                    fen: tempGame.fen(),
                    time: moveData.time
                  });
                }
              } catch (moveError) {
                console.error('Error processing move:', moveData.notation, moveError);
              }
            });
            formattedGameHistory.moves = convertedMoves;
          } else if (!Array.isArray(gameData.moves)) {
              formattedGameHistory.moves = convertedMoves; // Just have the start move
          } else {
            // Already in correct format
            formattedGameHistory.moves = gameData.moves;
          }

          setGameHistory(formattedGameHistory);
        }
      } catch (err) {
        console.error('Error loading game data:', err);
        setError('Failed to load game data. ' + err.message);
        setGameHistory({ moves: [] });
      } finally {
        setLoading(false);
      }
    };

    loadGameData();
  }, [gameId, location.state, searchParams]);

  useEffect(() => {
    // Reset the board to the initial position when the game history is loaded.
    const newGame = new Chess();
    setGame(newGame);
    setCurrentMoveIndex(0);
  }, [gameHistory]); // Reset when gameHistory changes

  // REVISED: ResizeObserver logic
  useEffect(() => {
    if (!boardBoxRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width } = entry.contentRect; // Only need width
      const vh = window.innerHeight;
      
      // Size is the container's width, but no more than viewport height minus padding
      const newSize = Math.floor(Math.min(width, vh - 120)); // 120px for header/padding

      if (newSize > 0) { // Only set if valid size
        setBoardSize(newSize);
      }
    });
    ro.observe(boardBoxRef.current);
    return () => ro.disconnect();
  }, []); // Empty dependency array is correct here

  const playMoves = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrentMoveIndex((prevIndex) => {
        const nextIndex = prevIndex + 1;
        if (gameHistory && Array.isArray(gameHistory.moves) && nextIndex < gameHistory.moves.length) {
          const newGame = new Chess();
          for (let i = 1; i <= nextIndex; i++) {
            const moveEntry = gameHistory.moves[i];
            if (moveEntry && moveEntry.move && moveEntry.move.san && moveEntry.move.san !== 'Start') {
              const result = newGame.move(moveEntry.move.san);
              if (!result) {
                console.error(`Invalid replay move in playMoves (Index ${i}):`, moveEntry.move.san, 'FEN:', newGame.fen());
                clearInterval(timerRef.current);
                return prevIndex;
              }
            }
          }
          setGame(newGame);
          return nextIndex;
        } else {
          clearInterval(timerRef.current);
          return prevIndex;
        }
      });
    }, 1000);
  };

  const pauseMoves = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const stepForward = () => {
    if (gameHistory && Array.isArray(gameHistory.moves) && currentMoveIndex < gameHistory.moves.length - 1) {
      const nextIndex = currentMoveIndex + 1;
      const newGame = new Chess();
      for (let i = 1; i <= nextIndex; i++) {
        const moveEntry = gameHistory.moves[i];
        if (moveEntry && moveEntry.move && moveEntry.move.san && moveEntry.move.san !== 'Start') {
          const result = newGame.move(moveEntry.move.san);
          if (!result) {
            console.error(`Invalid replay move in stepForward (Index ${i}):`, moveEntry.move.san, 'FEN:', newGame.fen());
            return;
          }
        }
      }
      setGame(newGame);
      setCurrentMoveIndex(nextIndex);
    }
  };

  const stepBackward = () => {
    if (currentMoveIndex <= 0) return;
    const targetIndex = currentMoveIndex - 1;
    const newGame = new Chess();
    for (let i = 1; i <= targetIndex; i++) {
      const moveEntry = gameHistory.moves[i];
      if (moveEntry && moveEntry.move && moveEntry.move.san && moveEntry.move.san !== 'Start') {
        const result = newGame.move(moveEntry.move.san);
        if (!result) {
          console.error(`Invalid replay move during stepBackward at index ${i}:`, moveEntry.move.san, 'FEN:', newGame.fen());
          return;
        }
      }
    }
    setGame(newGame);
    setCurrentMoveIndex(targetIndex);
  };

  // Share functionality - simplified to match GameCompletionAnimation.js
  const handleShareWithImage = async () => {
    try {
      // Show the card temporarily for capture
      setShowEndCard(true);

      // Wait for GameEndCard to render
      await new Promise(resolve => setTimeout(resolve, 300));

      // Find the actual GameEndCard element
      const cardElement = document.querySelector('.game-end-card');
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
            result: gameHistory.result,
            playerColor: gameHistory.player_color === 'w' ? 'white' : 'black',
            isWin: isWin(gameHistory.result),
            isDraw: isDraw(gameHistory.result),
            opponentName: gameHistory.opponent_name || (gameHistory.game_mode === 'computer' ? 'Computer' : 'Opponent'),
            playerName: user?.name || 'Player'
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
      const cardElement = document.querySelector('.game-end-card');
      if (cardElement) cardElement.classList.remove('share-mode');
    } finally {
      // Hide the card after a short delay
      setTimeout(() => setShowEndCard(false), 1000);
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

      // Show the card temporarily for capture
      setShowEndCard(true);
      console.log('✅ End card shown');

      // Wait for GameEndCard to render
      await new Promise(resolve => setTimeout(resolve, 300));
      console.log('✅ Wait completed');

      // Find the actual GameEndCard element
      const cardElement = document.querySelector('.game-end-card');
      console.log('🔍 Card element:', cardElement ? 'Found' : 'NOT FOUND');
      if (!cardElement) {
        throw new Error('GameEndCard not found');
      }

      // Add share-mode class for styling
      cardElement.classList.add('share-mode');
      console.log('✅ Share mode class added');

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
        game_id: gameHistory.id,
        user_id: user?.id,
        winner: isWin(gameHistory.result) ? 'player' : (isDraw(gameHistory.result) ? 'draw' : 'opponent'),
        playerName: user?.name || 'Player',
        opponentName: gameHistory.opponent_name || (gameHistory.game_mode === 'computer' ? 'Computer' : 'Opponent'),
        result: gameHistory.result,
        gameMode: gameHistory.game_mode
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
      const cardElement = document.querySelector('.game-end-card');
      if (cardElement) cardElement.classList.remove('share-mode');
    } finally {
      setIsTestSharing(false);
      // Hide the card after a short delay
      setTimeout(() => setShowEndCard(false), 1000);
    }
  };

  if (loading) {
    return (
      <div className="game-review p-6 min-h-screen text-white flex flex-col items-center justify-center">
        <h3 className="text-2xl font-bold mb-4 text-vivid-yellow">Loading Game...</h3>
        <div className="loading-message">Please wait while we load your game data.</div>
        <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-blue-violet hover:bg-picton-blue rounded-lg">Back</button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="game-review p-6 min-h-screen text-white flex flex-col items-center justify-center">
        <h3 className="text-2xl font-bold mb-4 text-red-500">Error Loading Game</h3>
        <div className="error-message">{error}</div>
        <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-blue-violet hover:bg-picton-blue rounded-lg">Back</button>
      </div>
    );
  }

  return (
    <div className="game-review p-1 sm:p-2 min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white overflow-y-auto mobile-scroll-container">
      <h3 className="text-xl font-bold text-center mb-2 text-vivid-yellow">Game Replay</h3>

      {/* Main Layout Container */}
      <div className="flex flex-col items-center justify-center max-w-6xl mx-auto px-2">

        {/* Chess Board Container */}
        <div className="w-full flex justify-center mb-3" ref={boardBoxRef}>
          <Chessboard position={game.fen()} boardWidth={boardSize} />
        </div>

        {/* Ultra-Compact Review Controls - Directly Below Board */}
        <div className="review-controls w-full max-w-[400px] bg-slate-800/95 backdrop-blur-lg rounded-xl p-2 mb-3 border border-slate-500/60 shadow-xl">
          {/* Control Buttons Row - Ultra Compact */}
          <div className="flex justify-center items-center gap-1 mb-1">
            <button onClick={playMoves} disabled={!gameHistory.moves || gameHistory.moves.length <= 1} className="control-button bg-ufo-green hover:bg-vivid-yellow text-white font-bold py-1 px-2 rounded transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-xs">▶</button>
            <button onClick={pauseMoves} className="control-button bg-ryb-orange hover:bg-vivid-yellow text-white font-bold py-1 px-2 rounded transition-all duration-200 hover:scale-105 text-xs">❚❚</button>
            <button onClick={stepBackward} disabled={currentMoveIndex <= 0} className="control-button bg-picton-blue hover:bg-blue-violet text-white font-bold py-1 px-2 rounded transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-xs">⏪</button>
            <button onClick={stepForward} disabled={!gameHistory.moves || currentMoveIndex >= gameHistory.moves.length - 1} className="control-button bg-picton-blue hover:bg-blue-violet text-white font-bold py-1 px-2 rounded transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-xs">⏩</button>
            <button onClick={() => navigate(-1)} className="control-button bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-2 rounded transition-all duration-200 hover:scale-105 text-xs">✕</button>
          </div>

          {/* Move Counter - Ultra Compact */}
          <div className="text-center bg-slate-700/60 rounded px-2 py-1">
            <p className="text-white text-xs"><span className="text-yellow-300 font-semibold">Move:</span> {currentMoveIndex} / {gameHistory.moves && gameHistory.moves.length > 0 ? gameHistory.moves.length - 1 : 0}</p>
          </div>
        </div>

        {/* Game Info Section - Below Controls */}
        <div className="w-full max-w-[400px] lg:max-w-[600px] grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Game Info Card */}
          <div className="game-info bg-gradient-to-r from-slate-800/95 to-gray-800/95 backdrop-blur-lg rounded-xl border border-slate-500/60 shadow-2xl p-3 text-white">
            <h4 className="text-yellow-300 font-semibold text-sm mb-2 text-center">Game Details</h4>

            {/* Basic Game Info - Ultra-compact */}
            <div className="space-y-1 mb-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-yellow-300">ID:</span>
                <span className="text-white font-mono">{gameHistory.id || 'Unknown'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-yellow-300">Date:</span>
                <span className="text-white">{gameHistory.played_at ? new Date(gameHistory.played_at).toLocaleDateString() : 'Unknown'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-yellow-300">Mode:</span>
                <span className="text-white">{gameHistory.game_mode || 'Unknown'}</span>
              </div>
              {gameHistory.computer_level && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-yellow-300">Level:</span>
                  <span className="text-white">{gameHistory.computer_level}</span>
                </div>
              )}
              {gameHistory.player_color && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-yellow-300">Color:</span>
                  <span className="text-white">{gameHistory.player_color === 'w' ? 'White' : 'Black'}</span>
                </div>
              )}
            </div>

            {/* Result Info */}
            <div className="bg-slate-700/60 rounded p-2 text-xs">
              <p className="text-white text-center mb-1">
                <span className="text-yellow-300">Result:</span> {typeof gameHistory.result === 'object' ? (gameHistory.result?.details || gameHistory.result?.status || 'Unknown') : (gameHistory.result || 'Unknown')}
              </p>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-yellow-300 font-medium">You</p>
                  <p className="text-white font-bold">{gameHistory.final_score || gameHistory.finalScore || 'N/A'}</p>
                </div>
                {gameHistory.opponent_score !== undefined && (
                  <div>
                    <p className="text-yellow-300 font-medium">Opp</p>
                    <p className="text-white font-bold">{gameHistory.opponent_score || 'N/A'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Additional Info Card */}
          <div className="game-stats bg-gradient-to-r from-slate-800/95 to-gray-800/95 backdrop-blur-lg rounded-xl border border-slate-500/60 shadow-2xl p-3 text-white">
            <h4 className="text-yellow-300 font-semibold text-sm mb-2 text-center">Statistics</h4>

            <div className="bg-slate-700/60 rounded p-2 text-xs space-y-2">
              <div className="grid grid-cols-2 gap-2 text-center">
                {gameHistory.result?.end_reason && (
                  <div>
                    <p className="text-yellow-300 font-medium">End</p>
                    <p className="capitalize">{gameHistory.result.end_reason}</p>
                  </div>
                )}
                <div>
                  <p className="text-yellow-300 font-medium">Moves</p>
                  <p className="font-bold">{gameHistory.moves && gameHistory.moves.length > 0 ? Math.max(0, gameHistory.moves.length - 1) : 0}</p>
                </div>
              </div>

              {/* Time Remaining - Compact */}
              {(gameHistory.white_time_remaining_ms !== null && gameHistory.white_time_remaining_ms !== undefined &&
                gameHistory.black_time_remaining_ms !== null && gameHistory.black_time_remaining_ms !== undefined) && (
                <div className="text-center pt-1 border-t border-slate-600/40">
                  <p className="text-yellow-300 font-medium mb-1">Time Left</p>
                  <div className="flex justify-center gap-3">
                    <span className="text-white">W: {Math.floor((gameHistory.white_time_remaining_ms || 0) / 1000)}s</span>
                    <span className="text-white">B: {Math.floor((gameHistory.black_time_remaining_ms || 0) / 1000)}s</span>
                  </div>
                </div>
              )}
            </div>

            {/* Compact Debug Section */}
            <div className="mt-2">
              <details className="bg-slate-800/50 rounded-lg p-1 border border-slate-600/30">
                <summary className="cursor-pointer text-white hover:text-yellow-300 transition-colors duration-200 text-xs">Debug ({gameHistory.moves?.length || 0} moves)</summary>
                <div className="bg-slate-900/70 p-1 rounded mt-1 text-xs text-slate-300 overflow-x-auto max-h-32 overflow-y-auto">
                  <div className="mb-2 text-yellow-300">
                    Total Moves: {gameHistory.moves?.length || 0} | Showing: {Math.min(10, gameHistory.moves?.length || 0)}
                  </div>
                  <pre className="text-xs">
                    {JSON.stringify(gameHistory.moves?.slice(0, 10), null, 2)}
                    {(gameHistory.moves?.length || 0) > 10 && (
                      <div className="text-yellow-300 mt-2">
                        ... and {gameHistory.moves.length - 10} more moves
                      </div>
                    )}
                  </pre>
                </div>
              </details>
            </div>
          </div>
        </div>

        {/* Moves List Section */}
        {gameHistory.moves && gameHistory.moves.length > 1 && (
          <div className="w-full max-w-[600px] mt-3">
            <details className="bg-slate-800/95 backdrop-blur-lg rounded-xl border border-slate-500/60 shadow-xl p-3">
              <summary className="cursor-pointer text-white hover:text-yellow-300 transition-colors duration-200 font-medium text-sm">
                All Moves ({Math.max(0, gameHistory.moves.length - 1)} total)
              </summary>
              <div className="mt-3 max-h-48 overflow-y-auto bg-slate-900/70 rounded-lg p-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 text-xs">
                  {gameHistory.moves.map((move, index) => (
                    index > 0 && <div key={index} className={`text-center p-1 rounded ${index === currentMoveIndex ? 'bg-yellow-500/20 border border-yellow-400/40' : 'bg-slate-800/50'}`}>
                      <div className="text-gray-400 mb-1">{`${Math.ceil(index/2)}.`}</div>
                      <div className="text-white font-mono">
                        {move.move?.san || '?'}
                      </div>
                      {move.time && (
                        <div className="text-gray-500 text-xs">
                          {move.time.toFixed(1)}s
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </details>
          </div>
        )}

        {/* Share Section */}
        {gameHistory.id && (
          <div className="w-full max-w-[600px] mt-3">
            <div className="bg-gradient-to-r from-slate-800/95 to-gray-800/95 backdrop-blur-lg rounded-xl border border-slate-500/60 shadow-xl p-4">
              <h4 className="text-yellow-300 font-semibold text-sm mb-3 text-center">Share This Game</h4>
              <p className="text-center text-gray-300 text-xs mb-3">
                Challenge your friends to beat this result!
              </p>

              {/* Share buttons container */}
              <div className="flex flex-col gap-3">
                {/* Test Share button - shares URL with preview */}
                <button
                  onClick={handleTestShare}
                  disabled={isTestSharing}
                  style={{
                    backgroundColor: isTestSharing ? '#6B7280' : '#3B82F6',
                    color: 'white',
                    padding: window.innerWidth <= 480 ? '12px 20px' : '14px 28px',
                    borderRadius: '10px',
                    border: 'none',
                    fontSize: window.innerWidth <= 480 ? '0.95rem' : '1.1rem',
                    fontWeight: '700',
                    cursor: isTestSharing ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: window.innerWidth <= 480 ? '8px' : '10px',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
                    width: '100%',
                    maxWidth: '400px',
                    margin: '0 auto',
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
                        style={{ width: window.innerWidth <= 480 ? '18px' : '22px', height: window.innerWidth <= 480 ? '18px' : '22px' }}
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
                        style={{ width: window.innerWidth <= 480 ? '18px' : '22px', height: window.innerWidth <= 480 ? '18px' : '22px' }}
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

                {/* Original Share button */}
              <button
                onClick={handleShareWithImage}
                style={{
                  backgroundColor: '#10B981',
                  color: 'white',
                  padding: window.innerWidth <= 480 ? '12px 20px' : '14px 28px',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: window.innerWidth <= 480 ? '0.95rem' : '1.1rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: window.innerWidth <= 480 ? '8px' : '10px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                  width: '100%',
                  maxWidth: '400px',
                  margin: '0 auto'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#059669';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#10B981';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
                }}
              >
                <svg
                  style={{ width: window.innerWidth <= 480 ? '18px' : '22px', height: window.innerWidth <= 480 ? '18px' : '22px' }}
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
              </div>
            </div>
          </div>
        )}
      </div>

      {/* GameEndCard Modal - Temporarily shown during share process */}
      {showEndCard && (
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
            alignItems: 'flex-start',
            zIndex: 9999,
            minHeight: '100vh',
            height: '100vh',
            padding: window.innerWidth <= 480 ? '10px' : '20px',
            paddingTop: window.innerWidth <= 480 ? '50px' : '80px',
            paddingBottom: window.innerWidth <= 480 ? '120px' : '140px',
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch'
          }}
          onClick={(e) => {
            // Close modal when clicking on backdrop
            if (e.target === e.currentTarget) {
              setShowEndCard(false);
            }
          }}
        >
          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowEndCard(false);
            }}
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
              zIndex: 10000,
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
            ×
          </button>

          {/* GameEndCard - Same structure as GameCompletionAnimation */}
          <GameEndCard
            result={gameHistory}
            user={user || {}}
            isAuthenticated={isAuthenticated}
            playerColor={gameHistory.player_color === 'w' ? 'white' : 'black'}
            score={gameHistory.final_score || 0}
            opponentScore={gameHistory.opponent_score || 0}
            isMultiplayer={gameHistory.game_mode === 'multiplayer'}
            computerLevel={gameHistory.computer_level}
          />
        </div>
      )}
    </div>
  );
};

export default GameReview;
