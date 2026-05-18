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
  const hasData = hasMoveReviewData(report) || moves.length > 0 || bestUses > 0;

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
              <div><span>Best moves</span><strong>{summary.best_move_count || 0}</strong></div>
              <div><span>Avg rank</span><strong>{summary.average_rank ?? '-'}</strong></div>
              <div><span>Best used</span><strong>{bestUses}</strong></div>
            </div>

            <div className="mrr-move-list">
              {moves.length === 0 ? (
                <div className="mrr-empty mrr-empty-compact">Only Best button usage was recorded.</div>
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
