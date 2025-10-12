// src/components/play/PlayShell.jsx
// PURE LAYOUT WRAPPER - NO GAME LOGIC

import React from 'react';
import './PlayShell.css';
import './PlayMobileLandscape.css'; // Mobile landscape overrides - must be imported last

/**
 * PlayShell - Layout wrapper for chess game pages
 *
 * IMPORTANT: This is a PURE PRESENTATION component with ZERO game logic.
 * All game state, timers, sounds, and move handling remain in PlayComputer and PlayMultiplayer.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.header - Header section (navigation, title)
 * @param {React.ReactNode} props.preGameSetup - Pre-game setup screen (difficulty, color selection)
 * @param {React.ReactNode} props.boardArea - Chess board component
 * @param {React.ReactNode} props.sidebar - Sidebar with game info, scores, timers, controls
 * @param {React.ReactNode} props.timerScore - Timer and score display (moved above board in normal mode, left side in landscape)
 * @param {React.ReactNode} props.modals - Game completion modal, checkmate notification, etc.
 * @param {boolean} props.showBoard - Whether to show the board layout (vs pre-game setup)
 * @param {string} props.mode - 'computer' or 'multiplayer' (for CSS customization)
 */
const PlayShell = ({
  header,
  preGameSetup,
  boardArea,
  sidebar,
  timerScore,
  modals,
  showBoard = true,
  mode = 'computer'
}) => {
  return (
    <div className={`play-shell-container play-shell-${mode}`}>
      {/* Persistent Header - always visible */}
      {header && (
        <div className="play-shell-header">
          {header}
        </div>
      )}

      {/* Pre-Game Setup Screen - shown before game starts */}
      {!showBoard && preGameSetup && (
        <div className="play-shell-setup">
          {preGameSetup}
        </div>
      )}

      {/* Main Game Layout - shown during game */}
      {showBoard && (
        <div className="play-shell-layout">
          {/* Timer/Score Section - positioned differently in mobile landscape */}
          {timerScore && (
            <div className="play-shell-timer-score">
              {timerScore}
            </div>
          )}

          {/* Board Section - center focus */}
          <div className="play-shell-board">
            {boardArea}
          </div>

          {/* Sidebar - game info, scores, timers, controls */}
          <div className="play-shell-sidebar">
            {sidebar}
            {/* In mobile landscape, move timer/score into sidebar */}
            {timerScore && (
              <div className="play-shell-sidebar-timer-score">
                {timerScore}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals and Overlays - rendered outside main layout */}
      {modals && (
        <div className="play-shell-modals">
          {modals}
        </div>
      )}
    </div>
  );
};

export default PlayShell;
