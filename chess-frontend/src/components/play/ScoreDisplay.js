
import React, { useMemo } from "react";
import { truncatePlayerName, getPlayerAvatar } from '../../utils/playerDisplayUtils';

// Piece values for material calculation
const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const STARTING_PIECES = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };

const getMoveClassInfo = (classification) => {
  switch (classification?.toLowerCase()) {
    case "excellent": return { icon: "⭐", label: "Excellent", color: "#81b64c" };
    case "great": return { icon: "🔥", label: "Great", color: "#81b64c" };
    case "good": return { icon: "✓", label: "Good", color: "#a3d160" };
    case "inaccuracy": return { icon: "?!", label: "Inaccuracy", color: "#e8a93e" };
    case "mistake": return { icon: "?", label: "Mistake", color: "#e8a93e" };
    case "blunder": return { icon: "??", label: "Blunder", color: "#c33a3a" };
    default: return null;
  }
};

const ScoreDisplay = ({
  playerScore,
  lastMoveEvaluation,
  computerScore,
  lastComputerEvaluation,
  isOnlineGame,
  mode = 'computer',
  playerData = null,
  opponentData = null,
  game = null, // Chess.js instance for material count
}) => {
  // Calculate material advantage from game position
  const materialInfo = useMemo(() => {
    if (!game || typeof game.board !== 'function') return { whiteMat: 0, blackMat: 0, diff: 0 };
    const board = game.board();
    let whiteMat = 0, blackMat = 0;
    for (const row of board) {
      for (const sq of row) {
        if (!sq) continue;
        const val = PIECE_VALUES[sq.type] || 0;
        if (sq.color === 'w') whiteMat += val;
        else blackMat += val;
      }
    }
    return { whiteMat, blackMat, diff: whiteMat - blackMat };
  }, [game?.fen?.()]);

  const formatScore = (score) => {
    if (typeof score !== 'number') return '0.0';
    return Math.abs(score).toFixed(1);
  };

  const playerMoveInfo = getMoveClassInfo(lastMoveEvaluation?.moveClassification);
  const opponentMoveInfo = getMoveClassInfo(lastComputerEvaluation?.moveClassification);

  // Determine who's winning by material
  const matDiff = materialInfo.diff; // positive = white ahead
  const hasAdvantage = matDiff !== 0;

  return (
    <div className="rounded-lg bg-[#262421] border border-[#3d3a37] overflow-hidden">
      {/* Material advantage bar */}
      {hasAdvantage && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a18] border-b border-[#3d3a37]">
          <span className="text-[10px] text-[#8b8987] uppercase tracking-wider">Material</span>
          <div className="flex-1 h-1.5 bg-[#3d3a37] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(95, Math.max(5, 50 + matDiff * 5))}%`,
                background: matDiff > 0 ? '#f0d9b5' : '#4a3728',
              }}
            />
          </div>
          <span className={`text-xs font-semibold tabular-nums ${matDiff > 0 ? 'text-[#f0d9b5]' : 'text-[#bababa]'}`}>
            {matDiff > 0 ? '+' : ''}{matDiff}
          </span>
        </div>
      )}

      {/* Score row */}
      <div className="flex items-stretch">
        {/* Opponent section */}
        <div className="flex-1 flex items-center gap-2 px-3 py-2 min-w-0">
          {/* Avatar */}
          {(() => {
            const avatarUrl = getPlayerAvatar(opponentData) || opponentData?.avatar_url;
            if (avatarUrl) {
              return <img src={avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />;
            }
            return <span className="text-xs flex-shrink-0">{mode === 'computer' ? '🤖' : '👤'}</span>;
          })()}
          <span className="text-xs text-[#bababa] truncate">
            {truncatePlayerName(opponentData?.name || (mode === 'computer' ? 'CPU' : 'Rival'))}
          </span>
          {/* Last move classification */}
          {opponentMoveInfo && (
            <span className="text-[10px] font-bold flex-shrink-0" style={{ color: opponentMoveInfo.color }}>
              {opponentMoveInfo.icon}
            </span>
          )}
          {/* Score */}
          <span className="ml-auto font-mono text-sm font-bold text-[#c33a3a] tabular-nums flex-shrink-0">
            {formatScore(computerScore)}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px bg-[#3d3a37] self-stretch" />

        {/* Player section */}
        <div className="flex-1 flex items-center gap-2 px-3 py-2 min-w-0">
          {(() => {
            const avatarUrl = getPlayerAvatar(playerData);
            if (avatarUrl) {
              return <img src={avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />;
            }
            return <span className="text-xs flex-shrink-0">👤</span>;
          })()}
          <span className="text-xs text-[#bababa] truncate">
            {truncatePlayerName(playerData?.name || playerData?.user?.name || 'You')}
          </span>
          {playerMoveInfo && (
            <span className="text-[10px] font-bold flex-shrink-0" style={{ color: playerMoveInfo.color }}>
              {playerMoveInfo.icon}
            </span>
          )}
          <span className="ml-auto font-mono text-sm font-bold text-[#81b64c] tabular-nums flex-shrink-0">
            {formatScore(playerScore)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ScoreDisplay;
