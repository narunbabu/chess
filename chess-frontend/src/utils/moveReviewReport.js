import { Chess } from 'chess.js';

export const REVIEW_REPORT_VERSION = 1;
export const DEFAULT_REVIEW_TOP_MOVES = 5;
export const BEST_USE_NUDGE_THRESHOLD = 5;
export const BEST_USE_NUDGE_MESSAGE = 'Try calculating first. Best moves are helpful, but using them too often will slow your improvement.';

export const getDefaultReviewEnabled = (ratedMode) => ratedMode !== 'rated';

export const shouldShowBestUseNudge = (bestButtonUses, threshold = BEST_USE_NUDGE_THRESHOLD) => (
  Number(bestButtonUses) > threshold
);

export const normalizeMoveToUci = (move) => {
  if (!move) return '';
  if (typeof move === 'string') return move.trim();
  if (move.move) return normalizeMoveToUci(move.move);
  if (move.uci) return normalizeMoveToUci(move.uci);

  const from = move.from || '';
  const to = move.to || '';
  if (!from || !to) return '';

  const promotion = move.promotion || move.promoted || '';
  return `${from}${to}${promotion}`.toLowerCase();
};

export const moveUciToSan = (fen, uci) => {
  if (!fen || !uci) return uci || '';

  try {
    const game = new Chess(fen);
    const moved = game.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci.slice(4, 5) : undefined,
    });
    return moved?.san || uci;
  } catch (_) {
    return uci;
  }
};

export const normalizeTopMoves = (fen, topMoves = [], limit = DEFAULT_REVIEW_TOP_MOVES) => {
  if (!Array.isArray(topMoves)) return [];

  return topMoves.slice(0, limit).map((entry, index) => {
    const uci = normalizeMoveToUci(entry?.move ?? entry?.uci ?? entry);
    const cpValue = entry?.cp;
    const cp = cpValue === null || cpValue === undefined || Number.isNaN(Number(cpValue))
      ? null
      : Number(cpValue);

    return {
      rank: Number(entry?.rank) || index + 1,
      move: uci,
      uci,
      san: entry?.san || moveUciToSan(fen, uci),
      cp,
    };
  }).filter(move => move.uci);
};

export const buildMoveReviewRecord = ({
  fenBefore,
  userMove,
  topMoves,
  ply,
  moveNumber,
  color,
  source = 'review',
  topMoveLimit = DEFAULT_REVIEW_TOP_MOVES,
}) => {
  const userMoveUci = normalizeMoveToUci(userMove);
  const rankedMoves = normalizeTopMoves(fenBefore, topMoves, topMoveLimit);
  const matchingMove = rankedMoves.find(move => move.uci === userMoveUci);
  const userMoveRank = matchingMove?.rank || null;
  const san = userMove?.san || moveUciToSan(fenBefore, userMoveUci);

  return {
    id: `${ply || 0}:${userMoveUci}:${source}`,
    ply: Number(ply) || null,
    moveNumber: Number(moveNumber) || null,
    color: color || null,
    fenBefore,
    userMove: userMoveUci,
    san,
    source,
    topMoveLimit,
    topMoves: rankedMoves,
    bestMove: rankedMoves[0] || null,
    userMoveRank,
    isOutsideTopMoves: Boolean(userMoveUci && rankedMoves.length > 0 && !matchingMove),
    createdAt: new Date().toISOString(),
  };
};

const roundToTwo = (value) => Math.round(value * 100) / 100;

export const getMoveRankCoinValue = (rank) => {
  const numericRank = Number(rank);
  if (numericRank === 1) return 3;
  if (numericRank === 2) return 2;
  if (numericRank === 3) return 1;
  return 0;
};

export const summarizeMoveReviewReport = ({
  moves = [],
  bestButtonUses = 0,
  reviewEnabledUsed = false,
  topMoveLimit = DEFAULT_REVIEW_TOP_MOVES,
} = {}) => {
  const analyzedMoves = moves.filter(move => Array.isArray(move.topMoves) && move.topMoves.length > 0);
  const rankedMoves = analyzedMoves.filter(move => (
    move.userMoveRank !== null
    && move.userMoveRank !== undefined
    && Number.isFinite(Number(move.userMoveRank))
  ));
  const rankTotal = rankedMoves.reduce((sum, move) => sum + Number(move.userMoveRank), 0);
  const top1Count = rankedMoves.filter(move => Number(move.userMoveRank) === 1).length;
  const top2Count = rankedMoves.filter(move => Number(move.userMoveRank) === 2).length;
  const top3Count = rankedMoves.filter(move => Number(move.userMoveRank) === 3).length;
  const outsideTopMovesCount = analyzedMoves.filter(move => move.isOutsideTopMoves).length;
  const coinsEarned = rankedMoves.reduce((sum, move) => sum + getMoveRankCoinValue(move.userMoveRank), 0);

  return {
    analyzed_moves: analyzedMoves.length,
    best_move_count: top1Count,
    top_1_count: top1Count,
    top_2_count: top2Count,
    top_3_count: top3Count,
    average_rank: rankedMoves.length > 0 ? roundToTwo(rankTotal / rankedMoves.length) : null,
    ranked_moves_count: rankedMoves.length,
    rank_sum: rankTotal,
    outside_top_moves_count: outsideTopMovesCount,
    outside_top_5_count: outsideTopMovesCount,
    coins_earned: coinsEarned,
    best_button_uses: Math.max(0, Number(bestButtonUses) || 0),
    review_enabled_used: Boolean(reviewEnabledUsed),
    top_move_limit: topMoveLimit,
  };
};

export const createMoveReviewReport = ({
  moves = [],
  bestButtonUses = 0,
  reviewEnabledUsed = false,
  gameMode = null,
  topMoveLimit = DEFAULT_REVIEW_TOP_MOVES,
} = {}) => {
  const summary = summarizeMoveReviewReport({
    moves,
    bestButtonUses,
    reviewEnabledUsed,
    topMoveLimit,
  });

  return {
    version: REVIEW_REPORT_VERSION,
    gameMode,
    topMoveLimit,
    moves,
    bestButtonUses: summary.best_button_uses,
    reviewEnabledUsed: summary.review_enabled_used,
    summary,
    generatedAt: new Date().toISOString(),
  };
};

export const hasMoveReviewData = (report) => {
  if (!report) return false;
  const moves = Array.isArray(report.moves) ? report.moves : [];
  const bestUses = Number(report.bestButtonUses ?? report.best_button_uses ?? report.summary?.best_button_uses ?? 0);
  return moves.length > 0 || bestUses > 0 || Boolean(report.reviewEnabledUsed ?? report.review_enabled_used);
};
