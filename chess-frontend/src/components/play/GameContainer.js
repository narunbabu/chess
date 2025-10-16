// src/components/play/GameContainer.js

import React from 'react';
import GameInfo from './GameInfo';
import ScoreDisplay from './ScoreDisplay';
import TimerDisplay from './TimerDisplay';
import GameControls from './GameControls';
import TimerButton from './TimerButton';
import { formatTime } from '../../utils/timerUtils';

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
    opponentName = 'Opponent',
    playerScore = 0,
    computerScore = 0,
    showScores = false,
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
    players = null,
    gameDataObj = null
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

  // Determine if it's computer's turn for computer mode
  const isComputerTurn = mode === 'computer'
    ? activeTimer === (playerColor === 'w' ? 'b' : 'w')
    : false;

  // Timer/Score Display Component
  const renderTimerScoreDisplay = () => {
    if (mode === 'computer') {
      // Computer mode: Show computer vs player with scores
      return (
        <div className="timer-score-display" style={{
          display: 'flex',
          flexDirection: 'column',
          marginBottom: '12px',
          gap: '8px',
          fontSize: '14px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px'
          }}>
            {/* Computer Timer and Score */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '6px',
              backgroundColor: isComputerTurn ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${isComputerTurn ? 'rgba(239, 68, 68, 0.5)' : 'rgba(239, 68, 68, 0.3)'}`,
              flex: '1',
              minWidth: '140px'
            }}>
              {isComputerTurn && (
                <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: '#ef4444', borderRadius: '50%', marginRight: '4px', animation: 'pulse 2s infinite' }}></span>
              )}
              <span style={{ fontSize: '16px', color: '#ef4444' }}>
                🤖
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: '500' }}>Computer</span>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#ef4444'
                }}>
                  {formatTime(computerTime)}
                </span>
              </div>
              {showScores && (
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#ef4444',
                  marginLeft: '8px'
                }}>
                  {computerScore || 0}
                </span>
              )}
            </div>

            {/* VS separator */}
            <div style={{
              fontSize: '12px',
              color: '#666',
              fontWeight: 'bold',
              padding: '0 4px'
            }}>
              VS
            </div>

            {/* Player Timer and Score */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '6px',
              backgroundColor: activeTimer === playerColor ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)',
              border: `1px solid ${activeTimer === playerColor ? 'rgba(34, 197, 94, 0.5)' : 'rgba(34, 197, 94, 0.3)'}`,
              flex: '1',
              minWidth: '140px'
            }}>
              {activeTimer === playerColor && (
                <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: '#22c55e', borderRadius: '50%', marginRight: '4px', animation: 'pulse 2s infinite' }}></span>
              )}
              {playerData?.avatar_url ? (
                <img
                  src={playerData.avatar_url}
                  alt={playerData.name || 'You'}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <span style={{ fontSize: '16px', color: '#22c55e' }}>
                  👤
                </span>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: '500' }}>You</span>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#22c55e'
                }}>
                  {formatTime(playerTime)}
                </span>
              </div>
              {showScores && (
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#22c55e',
                  marginLeft: '8px'
                }}>
                  {playerScore || 0}
                </span>
              )}
            </div>
          </div>
        </div>
      );
    } else {
      // Multiplayer mode: Show opponent vs player (no scores in timer)
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          gap: '8px',
          fontSize: '14px'
        }}>
          {/* Opponent Timer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            borderRadius: '6px',
            backgroundColor: !isMyTurn ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.1)',
            border: `1px solid ${!isMyTurn ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.2)'}`,
            flex: '1',
            minWidth: '120px'
          }}>
            {!isMyTurn && (
              <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: '#ef4444', borderRadius: '50%', marginRight: '4px', animation: 'pulse 2s infinite' }}></span>
            )}
            {opponentData?.avatar_url ? (
              <img
                src={opponentData.avatar_url}
                alt={opponentData.name || opponentName}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  objectFit: 'cover'
                }}
              />
            ) : (
              <span style={{ fontSize: '16px', color: !isMyTurn ? '#ef4444' : '#ccc' }}>
                👤
              </span>
            )}
            <span style={{ fontSize: '16px', color: !isMyTurn ? '#ef4444' : '#ccc' }}>
              {opponentName}
            </span>
            <span style={{
              fontFamily: 'monospace',
              fontSize: '14px',
              fontWeight: 'bold',
              color: !isMyTurn ? '#ef4444' : '#ccc',
              marginLeft: 'auto'
            }}>
              {formatTime(Math.floor(oppMs / 1000))}
            </span>
          </div>

          {/* VS separator */}
          <div style={{
            fontSize: '12px',
            color: '#666',
            fontWeight: 'bold',
            padding: '0 4px'
          }}>
            VS
          </div>

          {/* Player Timer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            borderRadius: '6px',
            backgroundColor: isMyTurn ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)',
            border: `1px solid ${isMyTurn ? 'rgba(34, 197, 94, 0.5)' : 'rgba(255, 255, 255, 0.2)'}`,
            flex: '1',
            minWidth: '120px'
          }}>
            {isMyTurn && (
              <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: '#22c55e', borderRadius: '50%', marginRight: '4px', animation: 'pulse 2s infinite' }}></span>
            )}
            {playerData?.avatar_url ? (
              <img
                src={playerData.avatar_url}
                alt={playerData.name || 'You'}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  objectFit: 'cover'
                }}
              />
            ) : (
              <span style={{ fontSize: '16px', color: isMyTurn ? '#22c55e' : '#ccc' }}>
                👤
              </span>
            )}
            <span style={{ fontSize: '16px', color: isMyTurn ? '#22c55e' : '#ccc' }}>
              You
            </span>
            <span style={{
              fontFamily: 'monospace',
              fontSize: '14px',
              fontWeight: 'bold',
              color: isMyTurn ? '#22c55e' : '#ccc',
              marginLeft: 'auto'
            }}>
              {formatTime(Math.floor(myMs / 1000))}
            </span>
          </div>
        </div>
      );
    }
  };

  // Sidebar Component
  const renderSidebar = () => {
    return (
      <>
        {/* Header Section (multiplayer mode) */}
        {header && header}

        {/* GameInfo */}
        <GameInfo
          gameStatus={mode === 'computer' ? gameStatus : undefined}
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
          gameStatus={mode === 'multiplayer' ? gameStatus : undefined}
        />

        {/* ScoreDisplay */}
        <ScoreDisplay
          playerScore={playerScore}
          lastMoveEvaluation={lastMoveEvaluation}
          computerScore={computerScore}
          lastComputerEvaluation={mode === 'computer' ? lastComputerEvaluation : lastOpponentEvaluation}
          isOnlineGame={isOnlineGame}
          players={mode === 'multiplayer' ? {
            'w': gameDataObj?.white_player,
            'b': gameDataObj?.black_player
          } : players}
          playerColor={mode === 'multiplayer' && typeof playerColor === 'string' && playerColor.length > 1
            ? (playerColor === 'white' ? 'w' : 'b')
            : playerColor}
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
