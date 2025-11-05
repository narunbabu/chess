// src/components/play/GameContainer.js

import React from 'react';
import GameInfo from './GameInfo';
import ScoreDisplay from './ScoreDisplay';
import TimerDisplay from './TimerDisplay';
import GameControls from './GameControls';
import TimerButton from './TimerButton';

/**
 * GameContainer - Unified game layout component
 *
 * Provides consistent layout structure for both computer and multiplayer modes:
 * - Timer/Score display above board
 * - Board area (provided as children)
 * - Sidebar with game info, scores, timers, controls
 *
 * @param {Object} props
 * @param {string} props.mode - 'computer' or 'multiplayer'
 * @param {React.ReactNode} props.children - Board component and controls
 * @param {React.ReactNode} props.header - Header section (optional, for multiplayer mode)
 * @param {Object} props.timerData - Timer-related data
 * @param {Object} props.gameData - Game state data
 * @param {Object} props.sidebarData - Sidebar component data
 * @param {Object} props.controlsData - Game controls data (optional, computer mode only)
 */
const GameContainer = ({
  mode = 'computer',
  children,
  header = null,
  timerData = {},
  gameData = {},
  sidebarData = {},
  controlsData = null
}) => {
  // Extract timer data
  const {
    playerTime,
    computerTime,
    myMs,
    oppMs,
    activeTimer,
    playerColor,
    isMyTurn,
    isTimerRunning,
    playerScore = 0, // Player's score
    computerScore = 0, // Computer/opponent's score (for both computer and multiplayer modes)
    playerData = null, // Player information with avatar
    opponentData = null // Opponent/computer information
  } = timerData;

  // Extract game data
  const {
    game,
    gameHistory = [],
    gameStatus,
    moveCompleted,
    isReplayMode = false,
    currentReplayMove = 0,
    settings = {},
    isOnlineGame = false,
    players = null
  } = gameData;

  // Extract sidebar data
  const {
    lastMoveEvaluation,
    lastComputerEvaluation,
    lastOpponentEvaluation,
    opponent,
    isPortrait: sidebarIsPortrait
  } = sidebarData;

  // Extract controls data (computer mode only)
  const {
    gameStarted,
    countdownActive,
    resetGame,
    handleTimer,
    pauseTimer,
    handleResign,
    replayPaused,
    startReplay,
    pauseReplay,
    savedGames,
    loadGame,
    moveCount,
    replayTimerRef,
    timerButtonColor,
    timerButtonText,
    handleTimerButtonPress,
    gameOver,
    isPortrait
  } = controlsData || {};

  
  // Timer/Score Display Component (currently unused - kept for potential future use)



  // Sidebar Component
  const renderSidebar = () => {
    return (
      <>
        {/* Header Section (multiplayer mode) */}
        {header && header}

        {/* GameInfo */}
        <GameInfo
          gameStatus={gameStatus}
          playerColor={playerColor}
          game={game}
          gameHistory={gameHistory}
          moveCompleted={mode === 'computer' ? moveCompleted : undefined}
          activeTimer={mode === 'computer' ? activeTimer : undefined}
          isReplayMode={mode === 'computer' ? isReplayMode : undefined}
          currentReplayMove={mode === 'computer' ? currentReplayMove : undefined}
          totalMoves={gameHistory.length}
          settings={mode === 'computer' ? settings : undefined}
          isOnlineGame={isOnlineGame}
          players={players}
          opponent={mode === 'multiplayer' ? opponent : undefined}
        />

        {/* ScoreDisplay */}
        <ScoreDisplay
          playerScore={playerScore}
          lastMoveEvaluation={lastMoveEvaluation}
          computerScore={computerScore}
          lastComputerEvaluation={mode === 'computer' ? lastComputerEvaluation : lastOpponentEvaluation}
          isOnlineGame={isOnlineGame}
          mode={mode}
          playerData={playerData}
          opponentData={opponentData}
        />

        {/* TimerDisplay - Both modes */}
        <TimerDisplay
          playerTime={mode === 'computer' ? playerTime : Math.floor(myMs / 1000)}
          computerTime={mode === 'computer' ? computerTime : Math.floor(oppMs / 1000)}
          activeTimer={mode === 'computer' ? activeTimer : (isMyTurn ? playerColor : (playerColor === 'w' ? 'b' : 'w'))}
          playerColor={playerColor}
          isPortrait={mode === 'computer' ? isPortrait : sidebarIsPortrait}
          isRunning={mode === 'computer' ? (isTimerRunning && activeTimer === playerColor) : isMyTurn}
          isComputerRunning={mode === 'computer' ? (isTimerRunning && activeTimer !== playerColor) : !isMyTurn}
          mode={mode}
          playerData={playerData}
          opponentData={opponentData}
        />

        {/* GameControls - Computer mode only */}
        {mode === 'computer' && controlsData && (
          <GameControls
            gameStarted={gameStarted}
            countdownActive={countdownActive}
            isTimerRunning={isTimerRunning}
            resetGame={resetGame}
            handleTimer={handleTimer}
            pauseTimer={pauseTimer}
            handleResign={handleResign}
            isReplayMode={isReplayMode}
            replayPaused={replayPaused}
            startReplay={startReplay}
            pauseReplay={pauseReplay}
            savedGames={savedGames}
            loadGame={loadGame}
            moveCount={moveCount}
            playerColor={playerColor}
            replayTimerRef={replayTimerRef}
          />
        )}

        {/* TimerButton - Computer mode only, conditional */}
        {mode === 'computer' && settings.requireDoneButton && !isReplayMode && (
          <TimerButton
            timerButtonColor={timerButtonColor}
            timerButtonText={timerButtonText}
            moveCompleted={moveCompleted}
            activeTimer={activeTimer}
            playerColor={playerColor}
            onClick={handleTimerButtonPress}
            disabled={gameOver || !moveCompleted || activeTimer !== playerColor}
          />
        )}
      </>
    );
  };

  return (
    <div className={mode === 'computer' ? 'play-computer-layout' : 'game-layout'}>
      {/* Sidebar */}
      <div className={mode === 'computer' ? 'sidebar' : 'game-sidebar'}>
        {renderSidebar()}
      </div>

      {/* Main Content Area */}
      <div className={mode === 'computer' ? 'main-content-area' : 'board-section'}>
        <div className="board-container">
          {/* Timer/Score Display Above Board */}
          {/* {renderTimerScoreDisplay()} */}

          {/* Board and Controls (passed as children) */}
          {children}
        </div>
      </div>
    </div>
  );
};

export default GameContainer;
