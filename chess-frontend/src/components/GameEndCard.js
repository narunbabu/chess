import React, { useMemo } from 'react';
import type { GameResult, CurrentUser, RatingUpdate } from '../types';
import chessPlayingKids from '../assets/images/chess-playing-kids-crop.png';
import logo from '../assets/images/logo.png';
import './GameEndCard.css';

// SVG Chess Piece Components (similar to Background.js)
const ChessKing = ({ className = "", ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 2C11.45 2 11 2.45 11 3V4H10C9.45 4 9 4.45 9 5S9.45 6 10 6H11V7C10.45 7 10 7.45 10 8S10.45 9 11 9H13C13.55 9 14 8.55 14 8S13.55 7 13 7V6H14C14.55 6 15 5.55 15 5S14.55 4 14 4H13V3C13 2.45 12.55 2 12 2M7.5 10C6.67 10 6 10.67 6 11.5V12.5C6 13.33 6.67 14 7.5 14H8.5L9 20H15L15.5 14H16.5C17.33 14 18 13.33 18 12.5V11.5C18 10.67 17.33 10 16.5 10H7.5Z"/>
  </svg>
);

const ChessQueen = ({ className = "", ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M4 14L3 15V16L4 17H20L21 16V15L20 14L18.5 7L17 6H16L14.5 7.5L12 5L9.5 7.5L8 6H7L5.5 7L4 14M6 16L7 10H8L9.5 11.5L12 9L14.5 11.5L16 10H17L18 16H6Z"/>
  </svg>
);

interface GameEndCardProps {
  result: GameResult;
  user: CurrentUser;
  ratingUpdate?: RatingUpdate;
  className?: string;
  score?: number;
  opponentScore?: number;
  playerColor?: string;
  isMultiplayer?: boolean;
  computerLevel?: number;
  isAuthenticated?: boolean;
}

const GameEndCard: React.FC<GameEndCardProps> = ({
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
}) => {
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
      gameMode: result.game_mode
    });

    const userId = user?.id;
    const hasUser = !!userId && isAuthenticated;

    // Fix result detection - handle multiple formats properly
    let isPlayerWin = false;
    if (userId && result.winner_user_id) {
      isPlayerWin = result.winner_user_id === userId;
    } else if (result.result?.winner === 'player' && result.user_id === userId) {
      isPlayerWin = true;
    } else if (result.player_color && result.result?.winner === 'player') {
      // For computer games, check if player color matches winner
      isPlayerWin = true;
    }

    const isDraw = result.result === '1/2-1/2' || result.end_reason === 'draw' || result.result?.status === 'draw';

    // Handle cases where white_player and black_player might not exist
    const isComputerGame = result.game_mode === 'computer' || result.game_mode === 'local_ai';
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
      avatar_url: playerIsWhite ? user?.avatar_url : (isComputerGame ? '🤖' : null),
      isComputer: playerIsWhite ? false : isComputerGame
    };

    const black_player = result.black_player || {
      id: !playerIsWhite ? result.user_id : null,
      name: !playerIsWhite ? (user?.name || 'Player') : (isComputerGame ? `Computer Level ${effectiveComputerLevel || 8}` : (result.opponent_name || 'Opponent')),
      rating: !playerIsWhite ? (user?.rating || 1200) : (isComputerGame ? (effectiveComputerLevel ? 1000 + (effectiveComputerLevel * 100) : 1800) : 1200),
      is_provisional: !playerIsWhite ? (user?.is_provisional || false) : false,
      avatar_url: !playerIsWhite ? user?.avatar_url : (isComputerGame ? '🤖' : null),
      isComputer: !playerIsWhite ? false : isComputerGame
    };

    const isUserWhite = playerIsWhite;
    const isUserBlack = !playerIsWhite;
    const userPlayer = isUserWhite ? white_player : black_player;
    const opponentPlayer = isUserWhite ? black_player : white_player;

    const playersInfo = { white_player, black_player, userPlayer, opponentPlayer, isUserWhite, isUserBlack, hasUser };

    let resultText;
    if (isDraw) {
      resultText = `Draw by ${result.end_reason}`;
    } else {
      // Determine winner name based on available data
      let winnerName;
      if (result.winner_player === 'white' || (result.player_color === 'w' && result.result?.winner === 'player')) {
        winnerName = white_player.name;
      } else if (result.winner_player === 'black' || (result.player_color === 'b' && result.result?.winner === 'player')) {
        winnerName = black_player.name;
      } else {
        winnerName = white_player.name; // Default fallback
      }
      const reasonText = result.end_reason || result.result?.details || 'game completion';
      if (userId && isPlayerWin) {
        resultText = `You defeated ${opponentPlayer?.name || 'the opponent'} by ${reasonText}!`;
      } else if (userId && !isPlayerWin) {
        resultText = `${winnerName} defeated you by ${reasonText}!`;
      } else {
        // Guest/viewer mode
        resultText = `${winnerName} won by ${reasonText}!`;
      }
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

      // Method 1: Calculate from moves (most accurate - actual play time)
      if (result.moves) {
        let moves = [];
        // Handle different move formats
        if (typeof result.moves === 'string') {
          try {
            // Try to parse if it's a JSON string
            moves = JSON.parse(result.moves);
          } catch {
            // If not JSON, it might be in compact format "e4,2.52;Nf6,0.98;..."
            const moveEntries = result.moves.split(';');
            moveEntries.forEach(entry => {
              const [notation, time] = entry.split(',');
              if (time) {
                moves.push({ time: parseFloat(time), timeSpent: parseFloat(time), time_spent: parseFloat(time) });
              }
            });
          }
        } else if (Array.isArray(result.moves)) {
          moves = result.moves;
        }

        // Sum up the time from all moves
        moves.forEach((move) => {
          // Accept different time property formats: time_spent (snake_case), timeSpent (camelCase), or time
          const moveTime = move.time_spent || move.timeSpent || move.time || 0;
          if (moveTime > 0) {
            durationSeconds += moveTime;
          }
        });
        console.log('Duration from moves sum:', durationSeconds, 'seconds from', moves.length, 'moves');
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

      // Ensure we have a valid positive duration
      if (durationSeconds < 0) {
        durationSeconds = 0;
      }

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

  const handleAvatarError = (e: React.SyntheticEvent<HTMLImageElement, Event>, name: string, background: string) => {
    e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${background}&color=fff&size=128`;
  };

  const PlayerCard: React.FC<{
    player: typeof result.white_player;
    isCurrentUser: boolean;
    color: 'white' | 'black',
    score: number
  }> = ({ player, isCurrentUser, color, score }) => (
    <div className={`flex items-center gap-4 p-4 rounded-2xl shadow-md transition-all duration-300 ${
      isCurrentUser
        ? 'bg-gradient-to-r from-sky-50 to-blue-50 border-2 border-sky-300'
        : 'bg-white border-2 border-gray-200'
    }`}>
      <div className="relative flex-shrink-0">
        {player.isComputer ? (
          // Computer avatar - show emoji with modern styling
          <div className="w-20 h-20 rounded-full border-4 flex items-center justify-center text-4xl bg-gradient-to-br from-gray-100 to-gray-200 shadow-lg"
               style={{ borderColor: color === 'white' ? '#E5E7EB' : '#4B5563' }}>
            🤖
          </div>
        ) : (
          // Human avatar - show image with better styling
          <img
            src={player.avatar_url}
            alt={player.name}
            className="w-20 h-20 rounded-full border-4 object-cover shadow-lg"
            style={{ borderColor: color === 'white' ? '#E5E7EB' : '#4B5563' }}
            onError={(e) => handleAvatarError(e, player.name, color === 'white' ? '4f46e5' : '1f2937')}
            crossOrigin="anonymous"
          />
        )}
        <div className={`absolute -bottom-1 -right-1 text-3xl shadow-md ${
          color === 'white' ? 'text-gray-700' : 'text-gray-900'
        }`}>
          {color === 'white' ? <ChessKing className="w-8 h-8" /> : <ChessKing className="w-8 h-8" />}
        </div>
      </div>
      <div className="flex-grow">
        <div className="font-bold text-gray-800 text-xl mb-1">
          {player.name}
          {isCurrentUser && <span className="text-sm font-medium text-sky-600 ml-2">(You)</span>}
        </div>
        <div className="text-base text-gray-600 font-medium">
          Rating: {player.rating}
          {player.is_provisional && <span className="text-yellow-500 font-bold ml-1">?</span>}
        </div>
        {isCurrentUser && (
          <div className="text-sm text-sky-600 font-medium mt-1">
            {isPlayerWin ? '🏆 Winner' : isDraw ? '🤝 Draw' : '💪 Good Game'}
          </div>
        )}
      </div>
      <div className="text-center">
        <div className="text-3xl font-bold text-gray-800">
          {typeof score === 'number' ? score.toFixed(1) : '0.0'}
        </div>
        <div className="text-xs text-gray-500 uppercase tracking-wide">Score</div>
      </div>
    </div>
  );

  return (
    <div className={`game-end-card max-w-5xl w-full mx-auto rounded-3xl shadow-2xl overflow-hidden relative bg-white ${className}`}
         style={{
           backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.6)), url(${chessPlayingKids})`,
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundRepeat: 'no-repeat'
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
      <div className="absolute top-4 left-4 text-sky-200 opacity-30">
        <ChessKing className="w-12 h-12" />
      </div>
      <div className="absolute top-4 right-4 text-sky-200 opacity-30">
        <ChessQueen className="w-12 h-12" />
      </div>
      <div className="absolute bottom-4 left-4 text-sky-200 opacity-30">
        <ChessKing className="w-10 h-10" />
      </div>
      <div className="absolute bottom-4 right-4 text-sky-200 opacity-30">
        <ChessQueen className="w-10 h-10" />
      </div>

      {/* Main content */}
      <div className="relative z-10 p-8">
        {/* Header with logo */}
        <div className="text-center mb-6">
          <img src={logo} alt="Chess99" className="h-12 mx-auto mb-4" />
          <div className="inline-block bg-sky-600 text-white px-6 py-2 rounded-full font-semibold text-sm">
            {isMultiplayer ? 'Multiplayer Match' : `Computer Level ${computerLevel || 8}`}
          </div>
        </div>

        {/* Result display */}
        <div className="text-center mb-8">
          <div className={`text-8xl mb-4 ${isPlayerWin ? "text-yellow-500" : isDraw ? "text-gray-500" : "text-gray-400"}`}>
            {icon}
          </div>
          <h1 className={`text-4xl md:text-6xl font-extrabold mb-4 ${
            isPlayerWin ? "text-sky-600" : isDraw ? "text-gray-600" : "text-gray-500"
          }`}>
            {title}
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
            {resultText}
          </p>
        </div>

        {/* Players section */}
        <div className="space-y-4 mb-8">
          <PlayerCard
            player={playersInfo.white_player}
            isCurrentUser={playersInfo.hasUser && playersInfo.isUserWhite}
            color="white"
            score={playersInfo.isUserWhite ? (score !== undefined ? score : (result.final_score || result.finalScore || 0)) : (opponentScore !== undefined ? opponentScore : (result.opponent_score || 0))}
          />

          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-sky-100 text-sky-600 font-bold text-2xl shadow-md">
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

        {/* Game stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-sky-50 to-blue-50 p-4 rounded-2xl text-center border border-sky-200">
            <div className="text-3xl font-bold text-sky-600">
              {result.move_count || (result.moves ?
                (typeof result.moves === 'string' ?
                  result.moves.split(';').length :
                  (Array.isArray(result.moves) ? result.moves.length : '?')
                ) : '?')
              }
            </div>
            <div className="text-sm text-gray-600 uppercase tracking-wide mt-1">Moves</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-2xl text-center border border-green-200">
            <div className="text-3xl font-bold text-green-600">{gameDurationText}</div>
            <div className="text-sm text-gray-600 uppercase tracking-wide mt-1">Duration</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-4 rounded-2xl text-center border border-purple-200">
            <div className="text-3xl font-bold text-purple-600 capitalize">
              {result.end_reason || result.result?.end_reason || 'unknown'}
            </div>
            <div className="text-sm text-gray-600 uppercase tracking-wide mt-1">Result</div>
          </div>
        </div>

        {/* Rating update */}
        {ratingUpdate && !ratingUpdate.isLoading && !ratingUpdate.error && ratingUpdate.newRating !== null && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-4 rounded-2xl border-2 border-yellow-300 text-center mb-8">
            <div className="text-lg font-semibold text-gray-700">Rating Update</div>
            <div className="flex items-center justify-center gap-3 mt-2">
              <span className="text-gray-500 line-through">{ratingUpdate.oldRating}</span>
              <span className={`text-2xl font-bold ${ratingUpdate.ratingChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {ratingUpdate.ratingChange >= 0 ? '↑' : '↓'} {Math.abs(ratingUpdate.ratingChange)}
              </span>
              <span className="text-3xl font-bold text-gray-800">{ratingUpdate.newRating}</span>
            </div>
          </div>
        )}

        {/* Call to action */}
        <div className="text-center">
          <div className="bg-gradient-to-r from-sky-500 to-blue-600 text-white p-6 rounded-2xl shadow-lg">
            <div className="text-2xl font-bold mb-2">
              {playersInfo.hasUser ? (
                isPlayerWin ? "🏆 Congratulations!" : isDraw ? "🤝 Well Played!" : "💪 Great Effort!"
              ) : (
                "🏆 Exciting Game!"
              )}
            </div>
            <div className="text-lg mb-4">
              {playersInfo.hasUser ? (
                isPlayerWin
                  ? "Ready for your next victory?"
                  : isDraw
                  ? "Want to go for the win this time?"
                  : "Challenge yourself to improve!"
              ) : (
                "Ready to test your skills?"
              )}
            </div>
            <div className="flex items-center justify-center gap-2 text-lg font-semibold">
              <span>Play at</span>
              <a href="https://www.chess99.com" target="_blank" rel="noopener noreferrer" className="bg-white text-sky-600 px-3 py-1 rounded-lg font-bold hover:bg-sky-50 transition-colors">
                Chess99.com
              </a>
            </div>
          </div>
        </div>

        {/* Footer branding */}
        <div className="text-center mt-8 pt-6 border-t border-gray-200">
          <div className="text-gray-500 text-sm">
            India's Best Chess Site for Kids • Making Chess Fun! 🎯
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameEndCard;