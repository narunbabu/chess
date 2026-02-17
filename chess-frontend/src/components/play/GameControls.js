// src/components/play/GameControls.js
import React from "react";
import PawnColorSwitch from './PawnColorSwitch'; // Assuming this component exists or will be created
import DrawButton from '../game/DrawButton'; // Draw offer button
import { getResultDetails } from "../../utils/resultStandardization";

const GameControls = ({
  gameStarted,
  countdownActive,
  isTimerRunning,
  resetGame, // For Exit Replay and potentially post-game reset
  startGame,
  handleTimer, // This function toggles the timer (resumes the timer)
  setIsTimerRunning,
  pauseTimer,
  handleResign, // Handler for resignation
  isReplayMode,
  replayPaused,
  startReplay,
  pauseReplay,
  savedGames,
  loadGame,
  playerColor, // Pawn color prop
  onColorChange, // Handler for color change
  // Undo functionality props
  handleUndo,
  canUndo,
  gameOver,
  undoChancesRemaining, // Number of undo chances remaining
  // Draw functionality props
  handleDrawOffer,
  handleDrawAccept,
  handleDrawDecline,
  handleDrawCancel,
  drawState,
  ratedMode,
  currentGameId
}) => {
  const isRated = ratedMode === 'rated';

  const handlePauseAttempt = () => {
    if (isRated && !gameOver) {
      const confirmed = window.confirm(
        '⚠️ RATED GAME WARNING\n\n' +
        'You cannot pause a rated game!\n\n' +
        'If you pause or exit, you will FORFEIT this game and it will count as a LOSS.\n\n' +
        'Do you want to resign and forfeit this game?'
      );

      if (confirmed && handleResign) {
        console.log('[GameControls] 🏳️ Player resigned from rated game due to pause attempt');
        handleResign();
      }
    } else {
      // For casual games, allow pause/resume normally
      if (isTimerRunning) {
        pauseTimer();
      } else {
        handleTimer();
      }
    }
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  return (
    <div className="game-controls" style={{ marginTop: isMobile ? "4px" : "20px", textAlign: "center" }}>
      {/* Rated Game Warning */}
      {isRated && gameStarted && !gameOver && !isReplayMode && (
        <div style={{
          backgroundColor: '#3d3a37',
          border: '2px solid #e8a93e',
          borderRadius: '8px',
          padding: isMobile ? '6px 10px' : '12px 16px',
          marginBottom: isMobile ? '4px' : '15px',
          maxWidth: '600px',
          margin: isMobile ? '0 auto 4px auto' : '0 auto 15px auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
            <span style={{ fontSize: isMobile ? '14px' : '20px' }}>⚠️</span>
            <strong style={{ color: '#e8a93e', fontSize: isMobile ? '12px' : '14px' }}>RATED GAME</strong>
          </div>
          {!isMobile && (
            <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#bababa' }}>
              You cannot pause or exit this game. Closing the browser or leaving will result in automatic forfeiture and count as a LOSS.
            </p>
          )}
        </div>
      )}

      {/* Pawn Color Selection – only before game starts */}
      {!gameStarted && !isReplayMode && (
        <div style={{ marginBottom: '15px' }}>
          <PawnColorSwitch
            playerColor={playerColor}
            onColorChange={onColorChange}
          />
        </div>
      )}

      {/* Start Game button shown only if game hasn't started */}
      {!gameStarted && !countdownActive && !isReplayMode && (
        <button
          onClick={startGame}
          style={{
            padding: '15px 30px',
            fontSize: '1.2em',
            cursor: 'pointer',
          }}
        >
          Start Game
        </button>
      )}

      {/* In-Game Controls: Pause/Resume, Undo, and Resign */}
      {!isReplayMode && gameStarted && (
        <>
          {/* Pause/Resume Button - Only show for casual games */}
          {!isRated && (
            <button
              onClick={handlePauseAttempt}
              style={{ marginLeft: '10px' }}
            >
              {isTimerRunning ? "Pause" : "Resume"}
            </button>
          )}

          {/* Undo Last Move button - Only for casual games */}
          {handleUndo && !isRated && (
            <button
              onClick={() => {
                console.log('[GameControls] 🔧 Undo button clicked:', { canUndo, gameOver, gameStarted, undoChancesRemaining });
                handleUndo();
              }}
              disabled={!canUndo || gameOver}
              title={
                !canUndo
                  ? (gameOver
                    ? "Cannot undo - game is over"
                    : undoChancesRemaining <= 0
                      ? "No undo chances remaining"
                      : "Cannot undo - wait for your turn"
                  )
                  : `Undo last move (${undoChancesRemaining} chance${undoChancesRemaining !== 1 ? 's' : ''} remaining)`
              }
              style={{
                marginLeft: '10px',
                backgroundColor: canUndo && !gameOver && undoChancesRemaining > 0 ? '#81b64c' : '#4a4744',
                color: 'white',
                padding: '8px 16px',
                border: 'none',
                borderRadius: '4px',
                cursor: canUndo && !gameOver && undoChancesRemaining > 0 ? 'pointer' : 'not-allowed',
                opacity: canUndo && !gameOver && undoChancesRemaining > 0 ? 1 : 0.6,
                fontSize: undoChancesRemaining > 0 ? '14px' : '12px'
              }}
            >
              ↩️ Undo {undoChancesRemaining > 0 && `(${undoChancesRemaining})`}
            </button>
          )}

          {/* Draw Offer button */}
          {handleDrawOffer && drawState && currentGameId && (
            <div style={{ display: 'inline-block', marginLeft: '10px' }}>
              <DrawButton
                gameId={currentGameId}
                gameMode={ratedMode ? 'rated' : 'casual'}
                isComputerGame={true}
                onDrawOffered={handleDrawOffer}
                onDrawAccepted={handleDrawAccept}
                disabled={gameOver}
                drawStatus={drawState}
              />
            </div>
          )}

          {handleResign && (
            <button
              onClick={handleResign}
              className="resign-button"
              style={{
                marginLeft: '10px',
                backgroundColor: '#e74c3c',
                color: 'white',
                padding: '8px 16px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🏳️ Resign
            </button>
          )}
        </>
      )}

      {/* Replay controls */}
      {isReplayMode && (
        <div className="replay-controls" style={{ marginTop: "10px" }}>
          <button
            onClick={() => {
              replayPaused ? startReplay() : pauseReplay();
            }}
          >
            {replayPaused ? "Continue Replay" : "Pause Replay"}
          </button>
          <button onClick={resetGame} style={{ marginLeft: '10px' }}>Exit Replay</button>
        </div>
      )}

      {/* Saved games dropdown – only before game starts */}
      {!gameStarted && !isReplayMode && savedGames && savedGames.length > 0 && (
        <div className="saved-games" style={{ marginTop: "15px" }}>
          <select
            onChange={(e) => {
              if (e.target.value) {
                try {
                  const selectedGame = JSON.parse(e.target.value);
                  if (selectedGame && Array.isArray(selectedGame.moves)) {
                    loadGame(selectedGame);
                  } else {
                    console.error("Invalid game data format.", selectedGame);
                    alert("Failed to load game: Invalid data format.");
                  }
                } catch (error) {
                  console.error("Error parsing saved game data:", error);
                  alert("Failed to load game: Could not parse game data.");
                }
              }
            }}
            style={{ padding: "8px", marginRight: "8px" }}
            defaultValue=""
          >
            <option value="" disabled>
              Load Previous Game
            </option>
            {savedGames.map((game, index) => (
              game && game.date ? (
                <option key={game.id || index} value={JSON.stringify(game)}>
                  {new Date(game.date).toLocaleString()} - {getResultDetails(game.result)} (Score:{" "}
                  {game.finalScore !== undefined && game.finalScore !== null
                    ? Number(game.finalScore).toFixed(1)
                    : "N/A"}
                  )
                </option>
              ) : null
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

export default GameControls;
