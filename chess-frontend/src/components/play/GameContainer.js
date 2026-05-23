// src/components/play/GameContainer.js
// Premium 3-column game layout: Left Panel | Center Board (hero) | Right Panel

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import ActivePlayerBar from './ActivePlayerBar';
import SoundToggle from './SoundToggle';
import BoardCustomizer from './BoardCustomizer';
import PerformanceDisplay from '../game/PerformanceDisplay';
import ChatPanel from './ChatPanel';
import GameChat from './GameChat';
import CompanionControls from '../game/CompanionControls';
import CCTPanel from '../game/CCTPanel';
import PlayFeatureTour from './PlayFeatureTour';

// Extract SAN from any gameHistory entry format:
//   PlayComputer objects: { move: { san: "e4" }, ... }
//   Backend move objects:  { san: "e4", from: "e2", ... }
//   Compact strings:       "e4,3.45"
const extractSan = (entry) => {
  if (!entry) return null;
  if (typeof entry === 'string') return entry.split(',')[0];
  if (entry.move?.san) return entry.move.san;
  if (entry.san) return entry.san;
  return null;
};

const normalizeChessColor = (color) => {
  if (color === 'white') return 'w';
  if (color === 'black') return 'b';
  return color === 'b' ? 'b' : 'w';
};

const REVIEW_RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32', '#60A5FA', '#34D399'];
const REVIEW_USER_ARROW_COLOR = '#60A5FA';

const getMoveUci = (move) => (move?.uci || move?.move || move || '').toString().toLowerCase();
const uciToArrow = (uci, color, { opacity = 0.85, dashed = false } = {}) => {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci || '')) return null;
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    color,
    opacity,
    dashed,
  };
};

const buildReviewArrows = (result, topMoveLimit = 5) => {
  if (!result) return { arrows: [], labels: [] };

  const userMove = getMoveUci(result.userMove);
  const topMoves = (result.topMoves || []).slice(0, topMoveLimit);
  const arrows = [];
  const labels = [];
  const seen = new Set();

  topMoves.forEach((move, index) => {
    const uci = getMoveUci(move);
    if (!uci) return;
    const isUserMove = userMove && uci === userMove;
    const color = REVIEW_RANK_COLORS[index] || '#93c5fd';
    const arrow = uciToArrow(uci, color, { opacity: 0.9, dashed: true });
    if (!arrow) return;
    seen.add(uci);
    arrows.push(arrow);
    labels.push({
      square: uci.slice(0, 2),
      label: String(index + 1),
      color,
    });
    // Tag user's actual move with a checkmark badge stacked on the rank label.
    if (isUserMove) {
      arrow.userPicked = true;
    }
  });

  if (userMove && !seen.has(userMove)) {
    const userArrow = uciToArrow(userMove, REVIEW_USER_ARROW_COLOR, { opacity: 0.9, dashed: true });
    if (userArrow) {
      userArrow.userPicked = true;
      arrows.push(userArrow);
      labels.push({
        square: userMove.slice(0, 2),
        label: '✓',
        color: REVIEW_USER_ARROW_COLOR,
      });
    }
  }

  return { arrows, labels };
};

/**
 * GameContainer - Premium 3-zone game layout
 *
 * Desktop: [Left Info Panel] [Center Board Hero] [Right Moves Panel]
 * Mobile: Full-width board → compressed bars → bottom controls → collapsible panels
 */
const GameContainer = ({
  mode = 'computer',
  children,
  header = null,
  timerData = {},
  gameData = {},
  sidebarData = {},
  controlsData = null,
  actionBar = null,
  boardTheme,
  pieceStyle,
  onBoardThemeChange,
  onPieceStyleChange,
  chatData = null,
  companionData = null, // { companion: object, onMove: function, isMyTurn: boolean }
  cctData = null,       // { game, isActive, isRated, onArrowsChange }
  drawClaimInfo = null, // { available: bool, reason: string|null } — threefold/50-move claim status
  tourOpen = false,
  onTourOpen = () => {},
  tourStorageKey = 'chess99:casual_tour:v1:guest',
}) => {
  const [rightTab, setRightTab] = useState('moves');
  const [showRatedRules, setShowRatedRules] = useState(false);
  const [mobileRightPanelOpen, setMobileRightPanelOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(null);
  const [bestMoveRequestId, setBestMoveRequestId] = useState(0);
  const [isBestOn, setIsBestOn] = useState(false);
  const [inlineBestMoves, setInlineBestMoves] = useState(null); // {topMoves, fen} for inline strip
  const moveListRef = useRef(null);

  // Extract timer data
  const {
    playerTime, computerTime, myMs, oppMs, activeTimer, playerColor,
    isMyTurn, isTimerRunning, computerMoveInProgress = false,
    playerScore = 0, computerScore = 0,
    playerData = null, opponentData = null
  } = timerData;

  // Extract game data
  const {
    game, gameHistory = [], gameStatus, moveCompleted,
    isReplayMode = false, currentReplayMove = 0,
    settings = {}, isOnlineGame = false, players = null
  } = gameData;

  // Extract sidebar data
  const {
    lastMoveEvaluation, lastComputerEvaluation, lastOpponentEvaluation,
    performanceData: sidebarPerformanceData,
    showPerformance: sidebarShowPerformance
  } = sidebarData;

  // Extract controls data
  const {
    gameStarted, countdownActive, resetGame,
    handleTimer, pauseTimer, handleResign,
    replayPaused, startReplay, pauseReplay,
    handleUndo, canUndo, undoChancesRemaining,
    handleDrawOffer, drawState, currentGameId,
    gameOver, isPortrait, ratedMode, performanceData
  } = controlsData || {};

  const isRated = ratedMode === 'rated';
  const isLearningMode = ratedMode === 'learning';
  const isCasualMode = ratedMode === 'casual' || (!isRated && !isLearningMode);
  const allowCompanion = Boolean(companionData) && !isRated && !isLearningMode;
  const undoTitle = isLearningMode
    ? (canUndo ? `Undo - ${undoChancesRemaining} helplines left` : 'Cannot undo')
    : (canUndo ? `Undo (${undoChancesRemaining} left)` : 'Cannot undo');
  const bestMoveBudget = cctData?.bestMoveBudget;
  const bestMoveBudgetEnabled = Boolean(bestMoveBudget?.enabled);
  const bestMoveRemaining = bestMoveBudgetEnabled
    ? Math.max(0, Number(bestMoveBudget?.remaining || 0))
    : null;
  const bestMoveDisabled = gameOver || (bestMoveBudgetEnabled && bestMoveRemaining <= 0);
  const bestMoveTitle = bestMoveBudgetEnabled
    ? (bestMoveRemaining > 0 ? `Show Best (${bestMoveRemaining} helplines left)` : 'No best-move helplines remaining')
    : 'Show Best moves';
  const reviewState = cctData?.review || {};
  const reviewEnabled = Boolean(reviewState.enabled);
  const reviewLoading = Boolean(reviewState.loading);
  const latestReviewResult = reviewState.latestResult;
  const onShowReviewArrows = reviewState.onShowArrows;
  const onShowReviewLabels = reviewState.onShowLabels;
  const bestUseNudge = cctData?.bestUseNudge;
  const showReviewArrows = useCallback((result = latestReviewResult) => {
    if (!result || !onShowReviewArrows) return;
    const { arrows, labels } = buildReviewArrows(result, cctData?.topMoveLimit || 5);
    onShowReviewArrows(arrows);
    onShowReviewLabels?.(labels);
  }, [cctData?.topMoveLimit, latestReviewResult, onShowReviewArrows, onShowReviewLabels]);

  useEffect(() => {
    if (!latestReviewResult || reviewLoading || !onShowReviewArrows) return;
    showReviewArrows(latestReviewResult);
  }, [latestReviewResult, reviewLoading, onShowReviewArrows, showReviewArrows]);

  const requestBestMove = () => {
    if (!cctData || bestMoveDisabled) return;
    setMobileMoreOpen(null);
    // CCTPanel is the component that listens to bestMoveRequestId, runs
    // Stockfish, paints the Best arrows on the board, and emits the Top-5
    // payload consumed by the inline strip. It only mounts while the
    // 'learn' tab is the active right-panel tab, so we must switch tabs
    // even on mobile — otherwise the request goes nowhere and neither
    // the arrows nor the strip appear. We deliberately leave the mobile
    // drawer closed so the board + action bar stay visible; the panel
    // mounts off-screen and feeds the inline strip via onBestMovesReady.
    setRightTab('learn');
    setBestMoveRequestId(id => id + 1);
  };

  // Capture Best top moves emitted by CCTPanel so we can render them inline.
  const handleInlineBestMoves = useCallback((payload) => {
    setInlineBestMoves(payload || null);
    cctData?.onBestMovesReady?.(payload);
  }, [cctData]);

  // Clear inline strip when Best is toggled off or game ends.
  useEffect(() => {
    if (!isBestOn) setInlineBestMoves(null);
  }, [isBestOn]);

  const toggleReviewMode = () => {
    if (!cctData || gameOver) return;
    const nextEnabled = !reviewEnabled;
    reviewState.onChange?.(nextEnabled);
    setRightTab('learn');
    if (window.innerWidth <= 768) {
      setMobileRightPanelOpen(true);
    }
  };

  const openMobilePanel = (tab = rightTab) => {
    setMobileMoreOpen(null);
    setRightTab(tab);
    setMobileRightPanelOpen(true);
    if (tab === 'chat') {
      chatData?.onTabOpen?.();
    }
  };

  const getPanelTitle = (tab) => {
    if (tab === 'learn') return 'CCT';
    if (tab === 'companion') return 'Companion';
    return tab.charAt(0).toUpperCase() + tab.slice(1);
  };

  // Build move pairs for two-column algebraic notation
  const movePairs = useMemo(() => {
    const pairs = [];
    for (let i = 0; i < gameHistory.length; i += 2) {
      pairs.push({
        num: Math.floor(i / 2) + 1,
        white: extractSan(gameHistory[i]) || '...',
        whiteIdx: i,
        black: extractSan(gameHistory[i + 1]) || null,
        blackIdx: i + 1,
      });
    }
    return pairs;
  }, [gameHistory]);

  // Auto-scroll move list
  useEffect(() => {
    if (window.innerWidth <= 768 && !mobileRightPanelOpen) return;
    if (moveListRef.current) {
      const active = moveListRef.current.querySelector('[data-active="true"]');
      if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [gameHistory.length, mobileRightPanelOpen]);

  useEffect(() => {
    if (rightTab === 'companion' && !allowCompanion) {
      setRightTab('moves');
    }
  }, [rightTab, allowCompanion]);

  // Determine status for the info panel
  const getStatusLabel = () => {
    if (!game) return '';
    if (game.isCheckmate?.()) return 'Checkmate';
    if (game.isCheck?.()) return 'Check';
    if (game.isStalemate?.()) return 'Stalemate';
    if (game.isDraw?.()) return 'Draw';
    if (drawClaimInfo?.available && drawClaimInfo.reason === 'threefold_repetition') return 'Threefold Repetition';
    if (drawClaimInfo?.available && drawClaimInfo.reason === 'fifty_move_rule') return '50-Move Rule';
    if (gameOver) return 'Game Over';
    return game.turn?.() === 'w' ? "White's turn" : "Black's turn";
  };

  const getMoveClass = (classification) => {
    switch (classification?.toLowerCase()) {
      case 'excellent': case 'great': return 'gc-eval-great';
      case 'good': return 'gc-eval-good';
      case 'inaccuracy': return 'gc-eval-inaccuracy';
      case 'mistake': return 'gc-eval-mistake';
      case 'blunder': return 'gc-eval-blunder';
      default: return '';
    }
  };

  const lastMoveSummary = useMemo(() => {
    const playerChessColor = normalizeChessColor(playerColor);
    const opponentChessColor = playerChessColor === 'w' ? 'b' : 'w';
    const moves = gameHistory
      .map((entry, index) => ({
        san: extractSan(entry),
        color: index % 2 === 0 ? 'w' : 'b',
      }))
      .filter(move => move.san);

    const lastPlayer = [...moves].reverse().find(move => move.color === playerChessColor)?.san || '--';
    const lastOpponent = [...moves].reverse().find(move => move.color === opponentChessColor)?.san || '--';

    return { player: lastPlayer, opponent: lastOpponent };
  }, [gameHistory, playerColor]);

  const renderMobileLastMoves = (placement = 'center') => (
    <div className={`gc-mobile-last-moves gc-mobile-last-moves-${placement}`} aria-label="Last moves">
      <span className="gc-mobile-last-moves-label">Last</span>
      <span className="gc-mobile-last-move"><strong>You</strong> {lastMoveSummary.player}</span>
      <span className="gc-mobile-last-move"><strong>Opp</strong> {lastMoveSummary.opponent}</span>
    </div>
  );

  const renderMobileQuickActionButtons = (placement = 'portrait') => (
    <>
      {/* Pause/Resume — promoted to front of mobile row (casual only) */}
      {!isRated && !isLearningMode && !gameOver && (
        <button
          type="button"
          className="gc-mobile-action-btn gc-action-neutral gc-mobile-action-icon"
          onClick={() => (isTimerRunning ? pauseTimer?.() : handleTimer?.())}
          title={isTimerRunning ? 'Pause' : 'Resume'}
          aria-label={isTimerRunning ? 'Pause' : 'Resume'}
        >
          {isTimerRunning ? '⏸' : '▶'}
        </button>
      )}
      {/* Review checkbox — hidden while Best is on; the inline strip replaces it */}
      {cctData && !isRated && !gameOver && !isBestOn && (
        <label className="gc-mobile-review-label" title={reviewEnabled ? 'Turn Review off' : 'Show best move alternatives after each move'}>
          <input
            type="checkbox"
            checked={reviewEnabled}
            onChange={(e) => reviewState.onChange?.(e.target.checked)}
          />
          Review
        </label>
      )}
      {/* Undo */}
      {handleUndo && !isRated && (
        <button
          data-tour="action-undo"
          className={`gc-mobile-action-btn gc-action-info ${(!canUndo || gameOver) ? 'gc-action-disabled' : ''}`}
          onClick={handleUndo}
          disabled={!canUndo || gameOver}
          title={undoTitle}
        >
          Undo{undoChancesRemaining > 0 ? ` ${undoChancesRemaining}` : ''}
        </button>
      )}
      {/* Best — primary action, casual + learning */}
      {cctData && (isCasualMode || isLearningMode) && !gameOver && (
        <button
          data-tour="action-cct-best"
          className={`gc-mobile-action-btn gc-action-warning ${isBestOn ? 'gc-mobile-action-active' : ''} ${bestMoveDisabled ? 'gc-action-disabled' : ''}`}
          onClick={requestBestMove}
          disabled={bestMoveDisabled}
          title={isBestOn ? 'Best moves showing — tap to hide' : bestMoveTitle}
        >
          {isBestOn ? 'Best' : `Best${isLearningMode && bestMoveBudgetEnabled ? ` ${bestMoveRemaining}` : ''}`}
        </button>
      )}
      {/* More menu — now a vertical 3-dots icon to save row space.
          Pause/Resume promoted out of this menu (see icon button above). */}
      <div className="gc-mobile-action-menu-wrap">
        <button
          type="button"
          className={`gc-mobile-action-btn gc-action-neutral gc-mobile-action-icon ${mobileMoreOpen === placement ? 'gc-mobile-action-active' : ''}`}
          onClick={() => setMobileMoreOpen(open => open === placement ? null : placement)}
          aria-label="More play actions"
          aria-expanded={mobileMoreOpen === placement}
          title="More"
        >
          ⋮
        </button>
        {mobileMoreOpen === placement && (
          <div className="gc-mobile-action-menu" role="menu">
            {chatData && !gameOver && (
              <button type="button" role="menuitem"
                onClick={() => { setMobileMoreOpen(null); openMobilePanel('chat'); }}
              >
                Chat{chatData.unreadCount > 0 ? ` (${chatData.unreadCount})` : ''}
              </button>
            )}
            {cctData && !isRated && (
              <button type="button" role="menuitem"
                onClick={() => { setMobileMoreOpen(null); openMobilePanel('learn'); }}
                data-tour="tab-cct"
              >
                💡 CCT panel
              </button>
            )}
            {allowCompanion && (
              <button type="button" role="menuitem"
                data-tour="tab-companion"
                onClick={() => { setMobileMoreOpen(null); openMobilePanel('companion'); }}
              >
                🤝 Companion{companionData?.companion ? ' ✓' : ''}
              </button>
            )}
            <button type="button" role="menuitem" onClick={() => { setMobileMoreOpen(null); openMobilePanel('moves'); }}>
              📋 Moves
            </button>
            <button type="button" role="menuitem" onClick={() => { setMobileMoreOpen(null); openMobilePanel('info'); }}>
              Info
            </button>
            {!isRated && !isLearningMode && !gameOver && (
              <button type="button" role="menuitem" data-tour="action-help"
                onClick={() => { setMobileMoreOpen(null); onTourOpen(true); }}
              >
                ❓ Help
              </button>
            )}
            {handleDrawOffer && !gameOver && (
              <button type="button" role="menuitem"
                onClick={() => { setMobileMoreOpen(null); handleDrawOffer(); }}
              >
                ½ Draw
              </button>
            )}
            {handleResign && !gameOver && (
              <button type="button" role="menuitem" className="gc-mobile-action-menu-danger"
                onClick={() => { setMobileMoreOpen(null); handleResign(); }}
              >
                ⚑ Resign
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );

  // Inline Best Top-5 strip — replaces the Review row while Best is on so
  // the player keeps both the board and the action bar visible.
  const renderInlineBestStrip = () => {
    if (!isBestOn || !inlineBestMoves || !Array.isArray(inlineBestMoves.topMoves) || inlineBestMoves.topMoves.length === 0) return null;
    return (
      <div className="gc-inline-best-strip" aria-label="Top best moves">
        <span className="gc-inline-best-label">⭐ Best</span>
        {inlineBestMoves.topMoves.slice(0, 5).map((m, i) => (
          <span
            key={`${m.uci || m.move || i}-${i}`}
            className="gc-inline-best-item"
            style={{ borderLeftColor: REVIEW_RANK_COLORS[i] || '#93c5fd' }}
          >
            <span className="gc-inline-best-rank" style={{ color: REVIEW_RANK_COLORS[i] || '#93c5fd' }}>
              {i + 1}
            </span>
            <span className="gc-inline-best-san">{m.san || m.move}</span>
          </span>
        ))}
      </div>
    );
  };

  // ----- ACTION BAR -----
  const renderActionBar = () => {
    if (!gameStarted || isReplayMode) return null;
    return (
      <div className="gc-action-bar">
        <div className="gc-mobile-action-grid gc-mobile-action-grid-portrait">
          {renderMobileQuickActionButtons('portrait')}
        </div>
        {renderInlineBestStrip()}
        <div className="gc-desktop-action-group">
        {gameOver ? (
          /* ── Game over ── */
          resetGame && (
            <button className="gc-action-btn gc-action-primary" onClick={resetGame}>
              ♟ New Game
            </button>
          )
        ) : (
          <>
            {/* Pause/Resume — casual only */}
            {!isRated && !isLearningMode && (
              <button
                className="gc-action-btn gc-action-neutral"
                onClick={() => isTimerRunning ? pauseTimer?.() : handleTimer?.()}
              >
                {isTimerRunning ? '⏸ Pause' : '▶ Resume'}
              </button>
            )}

            {/* Best — primary, casual + learning */}
            {cctData && (isCasualMode || isLearningMode) && (
              <button
                data-tour="action-cct-best"
                className={`gc-action-btn gc-action-warning ${isBestOn ? 'gc-mobile-action-active gc-action-btn-active' : ''} ${bestMoveDisabled ? 'gc-action-disabled' : ''}`}
                onClick={requestBestMove}
                disabled={bestMoveDisabled}
                title={isBestOn ? 'Best moves showing — click to hide' : bestMoveTitle}
              >
                {isBestOn
                  ? '⭐ Best ✓'
                  : `⭐ Best${isLearningMode && bestMoveBudgetEnabled ? ` (${bestMoveRemaining})` : ''}`}
              </button>
            )}

            {/* Undo */}
            {handleUndo && !isRated && (
              <button
                data-tour="action-undo"
                className={`gc-action-btn gc-action-info ${(!canUndo) ? 'gc-action-disabled' : ''}`}
                onClick={handleUndo}
                disabled={!canUndo}
                title={undoTitle}
              >
                ↩ Undo{undoChancesRemaining > 0 ? ` (${undoChancesRemaining})` : ''}
              </button>
            )}

            {/* Review checkbox — hidden while Best is on (inline Best strip takes its place) */}
            {cctData && !isBestOn && (
              <label className="gc-action-review-label" title={reviewEnabled ? 'Turn Review off' : 'Show best move alternatives after each move you make'}>
                <input
                  type="checkbox"
                  checked={reviewEnabled}
                  onChange={(e) => reviewState.onChange?.(e.target.checked)}
                />
                Review
              </label>
            )}

            {/* Draw */}
            {handleDrawOffer && (
              <button className="gc-action-btn gc-action-warning" onClick={handleDrawOffer}>
                ½ Draw
              </button>
            )}

            {/* Rated Rules */}
            {isRated && (
              <div className="gc-action-rules-wrap" style={{ position: 'relative' }}>
                <button
                  className="gc-action-btn gc-action-neutral gc-action-rules"
                  onClick={() => setShowRatedRules(prev => !prev)}
                  title="Rated game rules"
                >
                  ℹ Rules
                </button>
                {showRatedRules && (
                  <div style={{
                    position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
                    backgroundColor: '#1a1a2e', border: '1px solid #fca5a5', borderRadius: '10px',
                    padding: '14px 16px', width: '240px', zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    fontSize: '13px', color: '#e5e5e5', lineHeight: 1.5
                  }}>
                    <div style={{ fontWeight: 700, color: '#fca5a5', marginBottom: '8px', fontSize: '14px' }}>⚠️ Rated Game Rules</div>
                    <div>🚫 No pausing</div>
                    <div>↶ No undo</div>
                    <div>🏳️ Leaving = forfeit</div>
                    <div>📊 Affects your rating</div>
                    <div style={{ marginTop: '8px', textAlign: 'right' }}>
                      <button onClick={() => setShowRatedRules(false)} style={{
                        background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer', fontSize: '12px'
                      }}>Got it</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* More — Help, Moves, Resign */}
            <div className="gc-action-rules-wrap" style={{ position: 'relative' }}>
              <button
                type="button"
                className={`gc-action-btn gc-action-neutral ${mobileMoreOpen === 'desktop' ? 'gc-mobile-action-active' : ''}`}
                onClick={() => setMobileMoreOpen(open => open === 'desktop' ? null : 'desktop')}
                title="More options"
              >
                More ▾
              </button>
              {mobileMoreOpen === 'desktop' && (
                <div className="gc-mobile-action-menu gc-desktop-more-menu" role="menu">
                  {!isRated && !isLearningMode && (
                    <button type="button" role="menuitem" data-tour="action-help"
                      onClick={() => { setMobileMoreOpen(null); onTourOpen(true); }}
                    >
                      ❓ Help
                    </button>
                  )}
                  <button type="button" role="menuitem"
                    onClick={() => { setMobileMoreOpen(null); setRightTab('moves'); setMobileRightPanelOpen(true); }}
                  >
                    📋 Moves
                  </button>
                  {handleResign && (
                    <button type="button" role="menuitem" className="gc-mobile-action-menu-danger"
                      onClick={() => { setMobileMoreOpen(null); handleResign(); }}
                    >
                      ⚑ Resign
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
        </div>
      </div>
    );
  };

  // ----- REPLAY BAR -----
  const renderReplayBar = () => {
    if (!isReplayMode) return null;
    return (
      <div className="gc-action-bar">
        <button className="gc-action-btn gc-action-neutral" onClick={() => replayPaused ? startReplay?.() : pauseReplay?.()}>
          {replayPaused ? '▶ Play' : '⏸ Pause'}
        </button>
        <button className="gc-action-btn gc-action-danger" onClick={resetGame}>
          ✕ Exit Replay
        </button>
      </div>
    );
  };

  // ----- MOVE LIST -----
  const renderMoveList = () => (
    <div className="gc-move-list" ref={moveListRef}>
      {movePairs.length === 0 ? (
        <div className="gc-move-empty">No moves yet</div>
      ) : (
        movePairs.map((pair) => (
          <div key={pair.num} className="gc-move-row">
            <span className="gc-move-num">{pair.num}.</span>
            <span
              className={`gc-move-cell ${pair.whiteIdx === gameHistory.length - 1 ? 'gc-move-active' : ''} ${getMoveClass(gameHistory[pair.whiteIdx]?.evaluation?.moveClassification)}`}
              data-active={pair.whiteIdx === gameHistory.length - 1}
            >
              {pair.white}
            </span>
            {pair.black ? (
              <span
                className={`gc-move-cell ${pair.blackIdx === gameHistory.length - 1 ? 'gc-move-active' : ''} ${getMoveClass(gameHistory[pair.blackIdx]?.evaluation?.moveClassification)}`}
                data-active={pair.blackIdx === gameHistory.length - 1}
              >
                {pair.black}
              </span>
            ) : <span className="gc-move-cell" />}
          </div>
        ))
      )}
    </div>
  );

  // ----- GAME INFO TAB -----
  const renderGameInfo = () => (
    <div className="gc-info-content">
      {/* Status */}
      <div className="gc-info-row">
        <span className="gc-info-label">Status</span>
        <span className="gc-info-value">{getStatusLabel()}</span>
      </div>
      {/* Mode */}
      <div className="gc-info-row">
        <span className="gc-info-label">Mode</span>
        <span className="gc-info-value">{isRated ? 'Rated' : isLearningMode ? 'Learning' : 'Casual'} · {mode === 'computer' ? 'vs Computer' : 'Multiplayer'}</span>
      </div>
      {/* Moves */}
      <div className="gc-info-row">
        <span className="gc-info-label">Moves</span>
        <span className="gc-info-value">{gameHistory.length}</span>
      </div>
      {/* Rated warning */}
      {isRated && gameStarted && !gameOver && (
        <div className="gc-rated-badge">
          ⚠ Rated — no pause, no undo, leaving = loss
        </div>
      )}
      {/* Performance */}
      {mode === 'computer' && ratedMode === 'rated' && performanceData && gameStarted && !gameOver && !isReplayMode && (
        <div style={{ marginTop: 12 }}>
          <PerformanceDisplay performanceData={performanceData} compact={true} />
        </div>
      )}
      {mode === 'multiplayer' && sidebarShowPerformance && sidebarPerformanceData && (
        <div style={{ marginTop: 12 }}>
          <PerformanceDisplay performanceData={sidebarPerformanceData} compact={true} showRealtime={true} />
        </div>
      )}
    </div>
  );

  // ----- CHAT PANEL -----
  const renderChatPanel = () => {
    if (mode === 'computer' && chatData) {
      return (
        <GameChat
          messages={chatData.messages}
          opponentName={chatData.opponentName}
          isOpponentThinking={chatData.isOpponentThinking}
          gameOver={chatData.gameOver}
          gameStarted={chatData.gameStarted}
          onSendMessage={chatData.onSendMessage}
          onPing={chatData.onPing}
        />
      );
    }
    return (
      <ChatPanel
        messages={chatData.messages}
        onSend={chatData.onSend}
        myUserId={chatData.myUserId}
        disabled={chatData.disabled}
      />
    );
  };

  // ----- COMPANION TAB -----
  const renderCompanionPanel = () => {
    const { companion, companions = [], onCompanionSelect, onCompanionDismiss, onMove, isMyTurn } = companionData || {};

    if (!allowCompanion) {
      return null;
    }

    // Companions are not allowed in rated games
    if (isRated) {
      return (
        <div style={{ padding: '24px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🏆</div>
          <p style={{ fontSize: '13px', color: '#bababa', marginBottom: '6px', fontWeight: 'bold' }}>
            Not available in Rated games
          </p>
          <p style={{ fontSize: '12px', color: '#8b8987', lineHeight: '1.5' }}>
            Companions can only assist in Casual games. Switch to Casual mode to use a companion.
          </p>
        </div>
      );
    }

    // Pick 5 companions whose ratings span around the opponent's rating:
    // ~2 below, ~1 near, ~2 above — so the learner can compare styles across skill levels.
    const opponentRating = opponentData?.rating || 1500;
    const nearbyCompanions = (() => {
      if (companions.length === 0) return [];
      const sorted = [...companions].sort((a, b) => a.rating - b.rating);
      // Find index of the companion closest to opponent rating
      let closest = 0;
      let minDiff = Math.abs(sorted[0].rating - opponentRating);
      for (let i = 1; i < sorted.length; i++) {
        const diff = Math.abs(sorted[i].rating - opponentRating);
        if (diff < minDiff) { minDiff = diff; closest = i; }
      }
      // Take a window of 5 centred on the closest match, clamped to array bounds
      const start = Math.max(0, Math.min(closest - 2, sorted.length - 5));
      return sorted.slice(start, start + 5);
    })();

    return (
      <div style={{ padding: '12px 8px' }}>
        {/* CompanionControls: keep one-move / until-stopped actions first on mobile */}
        {companion && !gameOver && (
          <CompanionControls
            companion={companion}
            game={game}
            onMove={onMove}
            onDismiss={onCompanionDismiss}
            isMyTurn={isMyTurn}
            disabled={!gameStarted || gameOver}
            compact={true}
          />
        )}

        {/* Companion picker */}
        <div style={{ marginBottom: '12px' }}>
          <p style={{ fontSize: '12px', color: '#8b8987', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Change companion
          </p>
          {companion && (
            <p style={{ fontSize: '12px', color: '#bababa', margin: '0 0 8px', lineHeight: '1.4' }}>
              {companion.name} is ready. The action buttons are above; change helper only if needed.
            </p>
          )}
          <select
            value={companion ? companion.id : ''}
            onChange={(e) => {
              if (e.target.value === '') {
                onCompanionDismiss?.();
              } else {
                const picked = nearbyCompanions.find(c => String(c.id) === e.target.value);
                if (picked) onCompanionSelect?.(picked);
              }
            }}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid #4a4744',
              backgroundColor: '#2d2b28',
              color: companion ? '#a855f7' : '#bababa',
              fontSize: '13px',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="">No companion</option>
            {nearbyCompanions.map(c => (
              <option key={c.id} value={String(c.id)}>
                {c.name} ({c.rating}{Math.abs(c.rating - opponentRating) <= 50 ? ' ≈ opp' : c.rating < opponentRating ? ' ↓' : ' ↑'})
              </option>
            ))}
          </select>
          {nearbyCompanions.length > 0 && (
            <p style={{ fontSize: '11px', color: '#8b8987', marginTop: '4px' }}>
              Showing 5 available companions. Opponent rating: {opponentRating}
            </p>
          )}
        </div>

        {/* CompanionControls — shown when a companion is active */}
        {!companion && (
          <p style={{ fontSize: '12px', color: '#8b8987', textAlign: 'center', marginTop: '16px' }}>
            Select a companion above. They will play moves <strong>on your behalf</strong> when you ask.
          </p>
        )}
      </div>
    );
  };

  // ----- CCT PANEL -----
  const renderCctPanel = () => {
    if (!cctData) return null;
    return (
      <CCTPanel
        game={cctData.game}
        isActive={cctData.isActive}
        isRated={cctData.isRated}
        onArrowsChange={cctData.onArrowsChange}
        onLabelsChange={cctData.onLabelsChange}
        bestMoveBudget={cctData.bestMoveBudget}
        bestMoveRequestId={bestMoveRequestId}
        topMoveLimit={cctData.topMoveLimit}
        reviewEnabled={reviewEnabled}
        reviewLoading={Boolean(reviewState.loading)}
        reviewResult={reviewState.latestResult}
        onReviewEnabledChange={reviewState.onChange}
        onBestButtonUse={cctData.onBestButtonUse}
        onBestMovesReady={handleInlineBestMoves}
        onBestStateChange={setIsBestOn}
      />
    );
  };

  // ----- RIGHT PANEL -----
  const renderRightPanel = () => {
    const tabs = [
      'moves',
      'info',
      ...(chatData ? ['chat'] : []),
      ...(allowCompanion ? ['companion'] : []),
      ...(cctData  ? ['learn'] : []),
    ];

    return (
      <div className={`gc-right-panel ${mobileRightPanelOpen ? 'mobile-open' : ''}`}>
        <div className="gc-mobile-panel-heading">
          <span>{getPanelTitle(rightTab)}</span>
          <button type="button" onClick={() => setMobileRightPanelOpen(false)} aria-label="Close panel">
            Close
          </button>
        </div>
        {/* Tabs */}
        <div className="gc-tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`gc-tab ${rightTab === tab ? 'gc-tab-active' : ''}`}
              onClick={() => {
                const prevTab = rightTab;
                setRightTab(tab);
                // Open mobile drawer when a tab is selected on mobile
                if (window.innerWidth <= 768) {
                  setMobileRightPanelOpen(true);
                }
                if (tab === 'chat') {
                  chatData?.onTabOpen?.();
                } else if (prevTab === 'chat') {
                  chatData?.onTabClose?.();
                }
              }}
            >
                {tab === 'moves' ? 'Moves'
                  : tab === 'info' ? 'Info'
                  : tab === 'learn' ? (
                    <span data-tour="tab-cct">💡 CCT</span>
                  )
                  : tab === 'companion' ? (
                    <span data-tour="tab-companion">
                      🤝{companionData?.companion ? (
                        <span style={{
                          marginLeft: 4,
                          background: '#a855f7',
                          color: '#fff',
                          borderRadius: '50%',
                          fontSize: '0.65rem',
                          padding: '1px 5px',
                          verticalAlign: 'middle',
                        }}>✓</span>
                      ) : null}
                    </span>
                  )
                  : (
                    <>
                      Chat
                      {chatData.unreadCount > 0 && (
                        <span style={{
                          marginLeft: 4,
                          background: '#e04040',
                          color: '#fff',
                          borderRadius: '50%',
                          fontSize: '0.65rem',
                          padding: '1px 5px',
                          verticalAlign: 'middle',
                        }}>
                          {chatData.unreadCount}
                        </span>
                      )}
                    </>
                  )
                }
              </button>
          ))}
        </div>
        {/* Tab content */}
        <div className="gc-tab-content">
          {rightTab === 'moves' && renderMoveList()}
          {rightTab === 'info' && renderGameInfo()}
          {rightTab === 'chat' && chatData && renderChatPanel()}
          {rightTab === 'companion' && allowCompanion && renderCompanionPanel()}
          {rightTab === 'learn' && renderCctPanel()}
        </div>
      </div>
    );
  };

  // ----- LEFT PANEL -----
  const renderLeftPanel = () => (
    <div className="gc-left-panel">
      {header && header}
      {/* Score display */}
      <div className="gc-score-section">
        <div className="gc-score-card">
          <span className="gc-score-label">{playerData?.name || 'You'}</span>
          <span className="gc-score-value gc-score-player">{typeof playerScore === 'number' ? Math.abs(playerScore).toFixed(1) : '0.0'}</span>
          {lastMoveEvaluation?.moveClassification && (
            <span className={`gc-eval-badge ${getMoveClass(lastMoveEvaluation.moveClassification)}`}>
              {lastMoveEvaluation.moveClassification}
            </span>
          )}
        </div>
        <div className="gc-score-divider">vs</div>
        <div className="gc-score-card">
          <span className="gc-score-label">{opponentData?.name || (mode === 'computer' ? 'CPU' : 'Opponent')}</span>
          <span className="gc-score-value gc-score-opponent">{typeof computerScore === 'number' ? Math.abs(computerScore).toFixed(1) : '0.0'}</span>
          {(mode === 'computer' ? lastComputerEvaluation : lastOpponentEvaluation)?.moveClassification && (
            <span className={`gc-eval-badge ${getMoveClass((mode === 'computer' ? lastComputerEvaluation : lastOpponentEvaluation).moveClassification)}`}>
              {(mode === 'computer' ? lastComputerEvaluation : lastOpponentEvaluation).moveClassification}
            </span>
          )}
        </div>
      </div>
      {/* Game status */}
      {drawClaimInfo?.available && drawClaimInfo.reason === 'threefold_repetition' ? (
        <div className="gc-status-bar" style={{ borderColor: '#e8a93e', color: '#e8a93e' }}>
          Threefold Repetition{drawClaimInfo.isCasual ? ' — Auto-Draw' : ' — Claim Available'}
        </div>
      ) : drawClaimInfo?.available && drawClaimInfo.reason === 'fifty_move_rule' ? (
        <div className="gc-status-bar" style={{ borderColor: '#e8a93e', color: '#e8a93e' }}>
          50-Move Rule — Claim Available
        </div>
      ) : gameStatus && !gameStatus.match(/^(White|Black)'s turn$/i) ? (
        <div className="gc-status-bar">{gameStatus}</div>
      ) : null}
    </div>
  );

  const renderMobileRail = () => {
    if (!gameStarted || isReplayMode) return null;

    return (
      <aside className="gc-mobile-rail" aria-label="Mobile game controls">
        <ActivePlayerBar
          name={opponentData?.name || (mode === 'computer' ? 'Computer' : 'Opponent')}
          rating={opponentData?.rating}
          playerData={opponentData}
          time={mode === 'computer' ? computerTime : (oppMs != null ? Math.floor(oppMs / 1000) : computerTime)}
          isActive={mode === 'computer' ? activeTimer === (playerColor === 'w' ? 'b' : 'w') : !isMyTurn}
          isWhite={playerColor === 'b'}
          game={game}
          isTop={true}
          mode={mode}
          isTimerRunning={mode === 'computer' ? (isTimerRunning && activeTimer !== playerColor) : !isMyTurn}
          isThinking={mode === 'computer' && computerMoveInProgress}
        />

        <div className="gc-mobile-rail-tools">
          {boardTheme !== undefined && onBoardThemeChange && (
            <BoardCustomizer
              boardTheme={boardTheme}
              pieceStyle={pieceStyle}
              onThemeChange={onBoardThemeChange}
              onPieceStyleChange={onPieceStyleChange}
            />
          )}
          <SoundToggle />
        </div>

        {renderMobileLastMoves('rail')}

        <div className="gc-mobile-rail-actions">
          {renderMobileQuickActionButtons('rail')}
        </div>

        <ActivePlayerBar
          name={playerData?.name || 'You'}
          rating={playerData?.rating}
          playerData={playerData}
          time={mode === 'computer' ? playerTime : (myMs != null ? Math.floor(myMs / 1000) : playerTime)}
          isActive={mode === 'computer' ? activeTimer === playerColor : isMyTurn}
          isWhite={playerColor === 'w'}
          game={game}
          isTop={false}
          mode={mode}
          isTimerRunning={mode === 'computer' ? (isTimerRunning && activeTimer === playerColor) : isMyTurn}
        />
      </aside>
    );
  };

  // ========== MAIN RENDER ==========
  return (
    <div className="gc-layout">
      {/* LEFT PANEL — scores, status (desktop only) */}
      {renderLeftPanel()}

      {/* CENTER — board hero zone */}
      <div className="gc-center">
        {/* Toolbar */}
        <div className="gc-toolbar">
          {boardTheme !== undefined && onBoardThemeChange && (
            <BoardCustomizer
              boardTheme={boardTheme}
              pieceStyle={pieceStyle}
              onThemeChange={onBoardThemeChange}
              onPieceStyleChange={onPieceStyleChange}
            />
          )}
          <SoundToggle />
        </div>

        {/* Opponent bar */}
        <ActivePlayerBar
          name={opponentData?.name || (mode === 'computer' ? 'Computer' : 'Opponent')}
          rating={opponentData?.rating}
          playerData={opponentData}
          time={mode === 'computer' ? computerTime : (oppMs != null ? Math.floor(oppMs / 1000) : computerTime)}
          isActive={mode === 'computer' ? activeTimer === (playerColor === 'w' ? 'b' : 'w') : !isMyTurn}
          isWhite={playerColor === 'b'}
          game={game}
          isTop={true}
          mode={mode}
          isTimerRunning={mode === 'computer' ? (isTimerRunning && activeTimer !== playerColor) : !isMyTurn}
          isThinking={mode === 'computer' && computerMoveInProgress}
        />

        {/* Board */}
        <div className="gc-board-wrapper" data-testid="chess-board" tabIndex={0}>
          {children}
        </div>

        {renderMobileLastMoves('center')}

        {/* Player bar */}
        <ActivePlayerBar
          name={playerData?.name || 'You'}
          rating={playerData?.rating}
          playerData={playerData}
          time={mode === 'computer' ? playerTime : (myMs != null ? Math.floor(myMs / 1000) : playerTime)}
          isActive={mode === 'computer' ? activeTimer === playerColor : isMyTurn}
          isWhite={playerColor === 'w'}
          game={game}
          isTop={false}
          mode={mode}
          isTimerRunning={mode === 'computer' ? (isTimerRunning && activeTimer === playerColor) : isMyTurn}
        />

        {/* Action bar / Replay bar — custom actionBar prop takes priority */}
        {actionBar || renderActionBar()}
        {renderReplayBar()}

        {bestUseNudge && !gameOver && (
          <div className="gc-best-use-nudge" role="status">
            {bestUseNudge}
          </div>
        )}

        {/* Post-move review result — visible in game area when Review is enabled */}
        {cctData && (latestReviewResult || reviewLoading) && (
          <ReviewResultInline
            result={latestReviewResult}
            loading={reviewLoading}
            topMoveLimit={cctData.topMoveLimit || 5}
            onShowArrows={showReviewArrows}
          />
        )}
      </div>

      {renderMobileRail()}

      {/* RIGHT PANEL — moves, game info */}
      {renderRightPanel()}

      {/* Feature tour for casual play */}
      {!isRated && (
        <PlayFeatureTour
          open={tourOpen}
          onClose={() => onTourOpen(false)}
          storageKey={tourStorageKey}
        />
      )}
    </div>
  );
};

// ─── Inline review result — shown below the board in the game area ────────────

function ReviewResultInline({ result, loading, topMoveLimit = 5, onShowArrows }) {
  if (loading) {
    return (
      <div className="gc-review-bar gc-review-bar-loading">
        Reviewing move...
      </div>
    );
  }
  if (!result) return null;

  const rankText = result.userMoveRank
    ? `Your move ranked #${result.userMoveRank} of ${topMoveLimit}`
    : `Your move was outside the top ${topMoveLimit}`;

  return (
    <div className="gc-review-bar">
      <span className="gc-review-bar-label">Review</span>
      <span className={`gc-review-bar-rank ${result.userMoveRank === 1 ? 'gc-review-rank-best' : result.userMoveRank && result.userMoveRank <= 2 ? 'gc-review-rank-good' : 'gc-review-rank-ok'}`}>
        {rankText}
      </span>
      <div className="gc-review-bar-list">
        {(result.topMoves || []).map((move, index) => {
          const isUserMove = move.rank === result.userMoveRank;
          return (
            <div
              key={`${move.rank}-${move.move}`}
              className={`gc-review-bar-item ${isUserMove ? 'gc-review-bar-user' : ''}`}
              style={{ borderColor: REVIEW_RANK_COLORS[index] || '#93c5fd' }}
            >
              <span className="gc-review-bar-move-rank" style={{ color: REVIEW_RANK_COLORS[index] || '#93c5fd' }}>
                {move.rank}.
              </span>
              <span className="gc-review-bar-move-san">{move.san || move.move}</span>
              {isUserMove && <span className="gc-review-bar-you-tag">You</span>}
            </div>
          );
        })}
        {result.isOutsideTopMoves && (
          <div className="gc-review-bar-item gc-review-bar-user gc-review-bar-outside">
            <span className="gc-review-bar-move-rank">You</span>
            <span className="gc-review-bar-move-san">{result.san || result.userMove}</span>
            <span className="gc-review-bar-you-tag">outside top {topMoveLimit}</span>
          </div>
        )}
      </div>
      <button
        type="button"
        className="gc-review-bar-replay"
        onClick={() => onShowArrows?.(result)}
        title="Show review arrows for 2 seconds"
      >
        Arrows
      </button>
    </div>
  );
}

export default GameContainer;
