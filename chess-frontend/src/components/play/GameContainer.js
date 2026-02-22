// src/components/play/GameContainer.js
// Premium 3-column game layout: Left Panel | Center Board (hero) | Right Panel

import React, { useState, useRef, useEffect, useMemo } from 'react';
import ActivePlayerBar from './ActivePlayerBar';
import SoundToggle from './SoundToggle';
import BoardCustomizer from './BoardCustomizer';
import PerformanceDisplay from '../game/PerformanceDisplay';

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
  onPieceStyleChange
}) => {
  const [rightTab, setRightTab] = useState('moves');
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

  // Build move pairs for two-column algebraic notation
  const movePairs = useMemo(() => {
    const pairs = [];
    for (let i = 0; i < gameHistory.length; i += 2) {
      pairs.push({
        num: Math.floor(i / 2) + 1,
        white: gameHistory[i]?.move?.san || '...',
        whiteIdx: i,
        black: gameHistory[i + 1]?.move?.san || null,
        blackIdx: i + 1,
      });
    }
    return pairs;
  }, [gameHistory]);

  // Auto-scroll move list
  useEffect(() => {
    if (moveListRef.current) {
      const active = moveListRef.current.querySelector('[data-active="true"]');
      if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [gameHistory.length]);

  // Determine status for the info panel
  const getStatusLabel = () => {
    if (!game) return '';
    if (game.isCheckmate?.()) return 'Checkmate';
    if (game.isCheck?.()) return 'Check';
    if (game.isStalemate?.()) return 'Stalemate';
    if (game.isDraw?.()) return 'Draw';
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

  // ----- ACTION BAR -----
  const renderActionBar = () => {
    if (!gameStarted || isReplayMode) return null;
    return (
      <div className="gc-action-bar">
        {/* Pause/Resume — casual only */}
        {!isRated && (
          <button
            className="gc-action-btn gc-action-neutral"
            onClick={() => isTimerRunning ? pauseTimer?.() : handleTimer?.()}
            disabled={gameOver}
          >
            {isTimerRunning ? '⏸ Pause' : '▶ Resume'}
          </button>
        )}
        {/* Undo — casual only */}
        {handleUndo && !isRated && (
          <button
            className={`gc-action-btn gc-action-info ${(!canUndo || gameOver) ? 'gc-action-disabled' : ''}`}
            onClick={handleUndo}
            disabled={!canUndo || gameOver}
            title={canUndo ? `Undo (${undoChancesRemaining} left)` : 'Cannot undo'}
          >
            ↩ Undo{undoChancesRemaining > 0 ? ` (${undoChancesRemaining})` : ''}
          </button>
        )}
        {/* Draw */}
        {handleDrawOffer && !gameOver && (
          <button
            className="gc-action-btn gc-action-warning"
            onClick={handleDrawOffer}
            disabled={gameOver}
          >
            ½ Draw
          </button>
        )}
        {/* Resign */}
        {handleResign && !gameOver && (
          <button
            className="gc-action-btn gc-action-danger"
            onClick={handleResign}
          >
            ⚑ Resign
          </button>
        )}
        {/* New Game — shown when game is over */}
        {gameOver && resetGame && (
          <button
            className="gc-action-btn gc-action-primary"
            onClick={resetGame}
          >
            ♟ New Game
          </button>
        )}
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
        <span className="gc-info-value">{isRated ? 'Rated' : 'Casual'} · {mode === 'computer' ? 'vs Computer' : 'Multiplayer'}</span>
      </div>
      {/* Moves */}
      <div className="gc-info-row">
        <span className="gc-info-label">Moves</span>
        <span className="gc-info-value">{gameHistory.length}</span>
      </div>
      {/* Rated warning */}
      {isRated && gameStarted && !gameOver && (
        <div className="gc-rated-badge">
          ⚠ Rated — no pause, no undo, closing forfeits
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

  // ----- RIGHT PANEL -----
  const renderRightPanel = () => (
    <div className="gc-right-panel">
      {/* Tabs */}
      <div className="gc-tabs">
        {['moves', 'info'].map((tab) => (
          <button
            key={tab}
            className={`gc-tab ${rightTab === tab ? 'gc-tab-active' : ''}`}
            onClick={() => setRightTab(tab)}
          >
            {tab === 'moves' ? 'Moves' : 'Game Info'}
          </button>
        ))}
      </div>
      {/* Tab content */}
      <div className="gc-tab-content">
        {rightTab === 'moves' && renderMoveList()}
        {rightTab === 'info' && renderGameInfo()}
      </div>
    </div>
  );

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
      {gameStatus && !gameStatus.match(/^(White|Black)'s turn$/i) && (
        <div className="gc-status-bar">{gameStatus}</div>
      )}
    </div>
  );

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
        <div className="gc-board-wrapper">
          {children}
        </div>

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
      </div>

      {/* RIGHT PANEL — moves, game info */}
      {renderRightPanel()}
    </div>
  );
};

export default GameContainer;
