import React from 'react';
import { hasMoveReviewData } from '../../utils/moveReviewReport';
import './MoveReviewReportModal.css';

const readSummary = (report) => report?.summary || report?.review_summary || {};

const readMoves = (report) => {
  if (Array.isArray(report?.moves)) return report.moves;
  if (Array.isArray(report?.review_report?.moves)) return report.review_report.moves;
  return [];
};

const readBestUses = (report, summary) => {
  return Number(
    report?.bestButtonUses
    ?? report?.best_button_uses
    ?? summary?.best_button_uses
    ?? 0
  ) || 0;
};

const readUndoUses = (report, summary) => {
  return Number(
    report?.undoButtonUses
    ?? report?.undo_button_uses
    ?? summary?.undo_button_uses
    ?? 0
  ) || 0;
};

const readNumber = (summary, key, fallback = 0) => Number(summary?.[key] ?? fallback) || 0;

const formatRank = (move, topMoveLimit) => {
  if (move?.userMoveRank) return `#${move.userMoveRank}`;
  if (move?.isOutsideTopMoves) return `Outside top ${topMoveLimit}`;
  return 'Unranked';
};

const MoveReviewReportModal = ({ open, onClose, report }) => {
  if (!open) return null;

  const summary = readSummary(report);
  const moves = readMoves(report);
  const topMoveLimit = report?.topMoveLimit || report?.top_move_limit || summary?.top_move_limit || 5;
  const bestUses = readBestUses(report, summary);
  const undoUses = readUndoUses(report, summary);
  const hasData = hasMoveReviewData(report) || moves.length > 0 || bestUses > 0 || undoUses > 0;
  const top1Count = readNumber(summary, 'top_1_count', summary.best_move_count);
  const top2Count = readNumber(summary, 'top_2_count');
  const top3Count = readNumber(summary, 'top_3_count');
  const outsideTop5Count = readNumber(summary, 'outside_top_5_count', summary.outside_top_moves_count);
  const coinsEarned = readNumber(summary, 'coins_earned');

  return (
    <div className="mrr-backdrop" role="presentation" onClick={onClose}>
      <div className="mrr-modal" role="dialog" aria-modal="true" aria-label="Game report" onClick={(event) => event.stopPropagation()}>
        <div className="mrr-header">
          <div>
            <p className="mrr-kicker">Game Report</p>
            <h2>Move Review</h2>
          </div>
          <button type="button" className="mrr-close" onClick={onClose} aria-label="Close report">x</button>
        </div>

        {!hasData ? (
          <div className="mrr-empty">No live review data was recorded for this game.</div>
        ) : (
          <>
            <div className="mrr-stats">
              <div><span>Analyzed</span><strong>{summary.analyzed_moves || moves.length}</strong></div>
              <div><span>Top 1</span><strong>{top1Count}</strong></div>
              <div><span>Top 2</span><strong>{top2Count}</strong></div>
              <div><span>Top 3</span><strong>{top3Count}</strong></div>
              <div><span>Avg rank</span><strong>{summary.average_rank ?? '-'}</strong></div>
              <div><span>Outside top 5</span><strong>{outsideTop5Count}</strong></div>
              <div><span>Best used</span><strong>{bestUses}</strong></div>
              <div><span>Undo used</span><strong>{undoUses}</strong></div>
              <div><span>Coins</span><strong>{coinsEarned}</strong></div>
            </div>

            {bestUses > 5 && (
              <div className="mrr-note">
                Best was used frequently in this game. Try calculating first before checking engine suggestions.
              </div>
            )}

            <div className="mrr-move-list">
              {moves.length === 0 ? (
                <div className="mrr-empty mrr-empty-compact">Only assistance usage was recorded.</div>
              ) : moves.map((move, index) => (
                <div key={move.id || `${index}-${move.userMove}`} className="mrr-move-row">
                  <div className="mrr-move-main">
                    <span className="mrr-ply">{move.ply || index + 1}</span>
                    <div>
                      <strong>{move.san || move.userMove}</strong>
                      <span>{formatRank(move, topMoveLimit)}</span>
                    </div>
                  </div>
                  <div className="mrr-candidates">
                    {(move.topMoves || []).map(candidate => (
                      <span
                        key={`${move.id || index}-${candidate.rank}-${candidate.move}`}
                        className={candidate.rank === move.userMoveRank ? 'mrr-user-candidate' : ''}
                      >
                        {candidate.rank}. {candidate.san || candidate.move}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MoveReviewReportModal;
