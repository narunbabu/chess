// src/components/play/GameControls.js
import React from "react";
import PawnColorSwitch from './PawnColorSwitch'; // Assuming this component exists or will be created

const GameControls = ({
  gameStarted,
  countdownActive,
  isTimerRunning,
  resetGame, // For Exit Replay and potentially post-game reset
  startGame,
  handleTimer, // This function toggles the timer (resumes the timer)
  setIsTimerRunning,
  pauseTimer,
  isReplayMode,
  replayPaused,
  startReplay,
  pauseReplay,
  savedGames,
  loadGame,
  playerColor, // Pawn color prop
  onColorChange, // Handler for color change
}) => {
  return (
    <div className="game-controls" style={{ marginTop: "20px", textAlign: "center" }}>
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

      {/* In-Game Controls: Pause/Resume */}
      {!isReplayMode && gameStarted && (
        <button
          onClick={() => {
            if (isTimerRunning) {
              // Pause the timer by clearing the interval
              pauseTimer();
            } else {
              // Resume the timer using the provided function
              handleTimer();
            }
          }}
          style={{ marginLeft: '10px' }}
        >
          {isTimerRunning ? "Pause" : "Resume"}
        </button>
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
                  {new Date(game.date).toLocaleString()} - {game.result} (Score:{" "}
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
