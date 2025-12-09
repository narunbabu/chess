# Modification Plan for PlayComputer.js Enhancements

**Date:** 2025-12-09

This document outlines the plan to implement three new features in `@chess-frontend/src/components/play/PlayComputer.js`:
1.  **Previous Moves Display**: Show and highlight the last three moves.
2.  **Offer Draw**: Allow the player to offer a draw to the computer.
3.  **Undo Move**: Allow the player to undo their last move (up to 3 times).

---

## 1. Previous Moves Display & Highlighting

This feature will display the last three moves and highlight the corresponding squares on the board when a move is clicked.

### New State Variables in `PlayComputer.js`

-   `highlightedMoveSquares`: `useState({})` - An object to store squares to highlight for a selected past move (e.g., `{ from: 'e2', to: 'e4' }`). This will be passed to `ChessBoard`.

**File: `chess-frontend/src/components/play/PlayComputer.js`**

```javascript
// ... imports

const PlayComputer = () => {
  // ... other state variables
  const [moveSquares, setMoveSquares] = useState({});
  const [highlightedMoveSquares, setHighlightedMoveSquares] = useState({}); // New state
  const [gameStarted, setGameStarted] = useState(false);
  // ... rest of the component
```

### New Component: `PreviousMoves.js`

-   **Location**: `chess-frontend/src/components/play/PreviousMoves.js`
-   **Purpose**: A presentational component to display a list of moves.
-   **Props**:
    -   `moves`: An array of the last 3 move objects from `gameHistory`.
    -   `onMoveClick`: A callback function that receives a move object when clicked.
-   **Functionality**:
    -   Renders the `san` (Standard Algebraic Notation) of each move.
    -   Calls `onMoveClick` when a move is clicked, passing the move object.

**File: `chess-frontend/src/components/play/PreviousMoves.js` (New File)**

```javascript
import React from 'react';

const PreviousMoves = ({ moves, onMoveClick }) => {
  if (!moves || moves.length === 0) {
    return null;
  }

  return (
    <div className="previous-moves-container mt-4 p-2 bg-white/5 rounded-lg">
      <h4 className="text-sm font-semibold text-gray-300 mb-2 px-2">Last 3 Moves:</h4>
      <ul className="text-sm text-white">
        {moves.map((moveEntry, index) => (
          <li
            key={index}
            onClick={() => onMoveClick(moveEntry.move)}
            className="cursor-pointer hover:bg-white/10 rounded px-2 py-1"
          >
            {`${moveEntry.moveNumber}. ${moveEntry.playerColor === 'w' ? '' : '...'}${moveEntry.move.san}`}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PreviousMoves;
```

### Modifications to `PlayComputer.js`

1.  **Integrate `PreviousMoves` component**:
    -   Import the new `PreviousMoves` component.
    -   Render it within `GameContainer`, likely in the sidebar area.
    -   Slice `gameHistory` to pass only the last 3 moves to it.

2.  **Implement `handlePreviousMoveClick` callback**:
    -   Create a new callback function `handlePreviousMoveClick(move)`.
    -   This function will set the `highlightedMoveSquares` state based on the `from` and `to` squares of the clicked `move` object.

**File: `chess-frontend/src/components/play/PlayComputer.js`**

```javascript
// ... other imports
import PreviousMoves from './PreviousMoves'; // New Import

// ... inside PlayComputer component

  // ... after other state variables
  const [highlightedMoveSquares, setHighlightedMoveSquares] = useState({});

  // New callback for handling clicks on previous moves
  const handlePreviousMoveClick = useCallback((move) => {
    if (move && move.from && move.to) {
      setHighlightedMoveSquares({
        [move.from]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' },
        [move.to]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' },
      });
      // Optional: clear highlights after a delay
      setTimeout(() => setHighlightedMoveSquares({}), 2000);
    }
  }, []);

  // ... inside the render section, within gameContainerSection

  const gameContainerSection = (
    <GameContainer
      // ... other props
      sidebarData={{
        lastMoveEvaluation,
        lastComputerEvaluation,
        previousMoves: gameHistory.slice(-3), // Pass last 3 moves
        onPreviousMoveClick: handlePreviousMoveClick, // Pass handler
      }}
      // ... other props
    >
      <ChessBoard
        // ... other props
        highlightedMoveSquares={highlightedMoveSquares} // Pass new prop
      />
    </GameContainer>
  );
```

### Modifications to `GameContainer.js`

To render the `PreviousMoves` component, `GameContainer.js` needs to be updated to accept and display it.

**File: `chess-frontend/src/components/play/GameContainer.js` (Assumed Structure)**

```javascript
// This is an assumed structure for GameContainer.js
// ... imports
import PreviousMoves from './PreviousMoves';

// ... inside GameContainer component, in the sidebar section
const { sidebarData } = props;

<div className="sidebar">
  {/* ... other sidebar content ... */}
  {sidebarData.previousMoves && (
    <PreviousMoves
      moves={sidebarData.previousMoves}
      onMoveClick={sidebarData.onPreviousMoveClick}
    />
  )}
</div>
```

### Modifications to `ChessBoard.js`

1.  **Accept new prop**:
    -   Add a new prop `highlightedMoveSquares`.
2.  **Render highlights**:
    -   Merge `highlightedMoveSquares` with existing square styling logic (`moveSquares`, `rightClickedSquares`) to render the highlights.

**File: `chess-frontend/src/components/play/ChessBoard.js` (Assumed Structure, likely wrapping `react-chessboard`)**

```javascript
// This is an assumed structure for a custom ChessBoard component
import React from 'react';
import { Chessboard } from 'react-chessboard';

const ChessBoard = ({
  game,
  boardOrientation,
  onDrop,
  moveFrom,
  setMoveFrom,
  rightClickedSquares,
  setRightClickedSquares,
  moveSquares,
  setMoveSquares,
  highlightedMoveSquares, // New prop
  playerColor,
  isReplayMode
}) => {

  // Merge all custom styles
  const customSquareStyles = {
    ...moveSquares,
    ...rightClickedSquares,
    ...highlightedMoveSquares,
  };

  return (
    <Chessboard
      position={game.fen()}
      onPieceDrop={onDrop}
      boardOrientation={boardOrientation}
      customSquareStyles={customSquareStyles}
      // ... other react-chessboard props
    />
  );
};

export default ChessBoard;

```

---

## 2. Offer Draw

This feature adds a button for the player to offer a draw.

### New State Variables in `PlayComputer.js`

-   `drawOfferState`: `useState('none')` - Can be `'none'`, `'offered'`, `'accepted'`, `'rejected'`.

**File: `chess-frontend/src/components/play/PlayComputer.js`**

```javascript
// ... imports

const PlayComputer = () => {
  // ... other state variables
  const [gameResult, setGameResult] = useState(null);
  const [drawOfferState, setDrawOfferState] = useState('none'); // New state
  const [playerScore, setPlayerScore] = useState(0);
  // ... rest of the component
```

### Modifications to `PlayComputer.js`

1.  **Add "Offer Draw" button**:
    -   The button and its handler will be passed via `controlsData` to `GameContainer`.

2.  **Implement `handleOfferDraw` callback**:
    -   This function will check the engine's evaluation to decide. For now, we will assume a utility `getComputerEvaluation` exists, similar to `makeComputerMove`.

**File: `chess-frontend/src/components/play/PlayComputer.js`**

```javascript
// ... imports
// Assuming a new utility for just getting evaluation
import { makeComputerMove, getComputerEvaluation } from "../../utils/computerMoveUtils";

// ... inside PlayComputer component

  // New callback for offering a draw
  const handleOfferDraw = useCallback(async () => {
    if (gameOver || !gameStarted || drawOfferState !== 'none') return;

    setDrawOfferState('offered');
    setGameStatus('Draw offered to computer...');

    try {
      // We assume a utility that can get an evaluation without making a move.
      // This might require modifying computerMoveUtils.
      const evaluation = await getComputerEvaluation(game, computerDepth); // e.g., returns { score: 0.2 }
      const score = evaluation.score; // in centipawns or pawns

      // Decision Logic: Accept if evaluation is very close to even.
      if (Math.abs(score) <= 0.5) { // Assuming score is in pawns
        setDrawOfferState('accepted');
        setGameStatus('Draw accepted by computer!');
        const status = { text: 'Draw by agreement', outcome: 'draw' };
        // Use a slight delay to let user read the message
        setTimeout(() => handleGameComplete(gameHistory, status), 1500);
      } else {
        setDrawOfferState('rejected');
        setGameStatus('Draw offer rejected by computer.');
        // Reset state after a few seconds
        setTimeout(() => setDrawOfferState('none'), 3000);
      }
    } catch (error) {
      console.error("Error getting evaluation for draw offer:", error);
      setGameStatus('Error processing draw offer.');
      setDrawOfferState('none');
    }
  }, [game, gameStarted, gameOver, drawOfferState, computerDepth, gameHistory, handleGameComplete]);


  // ... inside render section, in gameContainerSection props

  const gameContainerSection = (
    <GameContainer
      // ... other props
      controlsData={{
        // ... other controlsData props
        handleOfferDraw, // New handler
        drawOfferState, // Pass state to disable button
        gameOver,
        isPortrait
      }}
    >
    {/* ... */}
    </GameContainer>
  );
```

### Modifications to `GameContainer.js` (Controls)

The "Offer Draw" button would be added to the controls section managed by `GameContainer`.

**File: `chess-frontend/src/components/play/GameContainer.js` (Assumed Structure)**

```javascript
// In the controls section of GameContainer

const { controlsData } = props;

<div className="game-controls">
  {/* ... other buttons like resign, pause ... */}
  <button
    onClick={controlsData.handleOfferDraw}
    disabled={controlsData.gameOver || !controlsData.gameStarted || controlsData.drawOfferState !== 'none'}
    className="control-button"
  >
    {controlsData.drawOfferState === 'none' ? 'Offer Draw' : 'Draw Offered'}
  </button>
</div>
```

---

## 3. Undo Move

This feature allows the player to take back their last move and the computer's subsequent move.

### New State Variables in `PlayComputer.js`

-   `undoCount`: `useState(3)` - To track remaining undos.

**File: `chess-frontend/src/components/play/PlayComputer.js`**

```javascript
// ... imports

const PlayComputer = () => {
  // ... other state variables
  const [moveCount, setMoveCount] = useState(0);
  const [undoCount, setUndoCount] = useState(3); // New state
  const [timerButtonColor, setTimerButtonColor] = useState("grey");
  // ... rest of the component
```

### Modifications to `PlayComputer.js`

1.  **Add "Undo" button**:
    -   Passed via `controlsData` to `GameContainer`.

2.  **Implement `handleUndoMove` callback**:
    -   This function contains the core logic for reversing the game state.

**File: `chess-frontend/src/components/play/PlayComputer.js`**

```javascript
// ... inside PlayComputer component

  // Add a new state for undo count
  const [undoCount, setUndoCount] = useState(3);

  // New callback for undoing a move
  const handleUndoMove = useCallback(() => {
    // Validation checks
    if (undoCount <= 0 || gameOver || !gameStarted || gameHistory.length < 2) {
      return;
    }

    // It should be the player's turn to request an undo.
    if (game.turn() !== playerColor) {
        setGameStatus("Wait for your turn to undo.");
        return;
    }

    // Revert game state using two undos
    safeGameMutate(gameCopy => {
      gameCopy.undo(); // Undo computer's move
      gameCopy.undo(); // Undo player's move
    });

    // Decrement undo count
    setUndoCount(prev => prev - 1);

    // Get the history before the last two moves
    const newHistory = gameHistory.slice(0, -2);
    setGameHistory(newHistory);

    // Update move count
    setMoveCount(newHistory.length);

    // Resynchronize scores by recalculating from the new history
    let newPlayerScore = 0;
    let newComputerScore = 0;
    newHistory.forEach(entry => {
      if (entry.evaluation && entry.evaluation.total) {
        if (entry.playerColor === playerColor) {
          newPlayerScore += entry.evaluation.total;
        } else {
          newComputerScore += entry.evaluation.total;
        }
      }
    });
    setPlayerScore(newPlayerScore);
    setComputerScore(newComputerScore);

    // Reset last move evaluations to the one before the undone moves
    setLastMoveEvaluation(newHistory.length > 1 ? newHistory[newHistory.length - 2]?.evaluation : null);
    setLastComputerEvaluation(newHistory.length > 0 ? newHistory[newHistory.length - 1]?.evaluation : null);


    // Ensure timers are correct
    setActiveTimer(playerColor); // It's player's turn again
    if (!isTimerRunning) {
        startTimerInterval();
    }
    moveStartTimeRef.current = Date.now(); // Reset move start time

    setGameStatus(`Undo successful! ${undoCount - 1} undos remaining.`);

  }, [undoCount, gameOver, gameStarted, gameHistory, game, playerColor, safeGameMutate, isTimerRunning, startTimerInterval]);


  // ... inside render section, in gameContainerSection props

  const gameContainerSection = (
    <GameContainer
      // ... other props
      controlsData={{
        // ... other controlsData props
        handleUndoMove, // New handler
        undoCount, // Pass count for display
        gameOver,
        isPortrait
      }}
    >
    {/* ... */}
    </GameContainer>
  );
```

### Modifications to `GameContainer.js` (Controls)

The "Undo" button would be added to the controls section, displaying the remaining count.

**File: `chess-frontend/src/components/play/GameContainer.js` (Assumed Structure)**

```javascript
// In the controls section of GameContainer

const { controlsData } = props;
const canUndo = controlsData.undoCount > 0 && controlsData.gameStarted && !controlsData.gameOver;

<div className="game-controls">
  {/* ... other buttons ... */}
  <button
    onClick={controlsData.handleUndoMove}
    disabled={!canUndo}
    className="control-button"
  >
    Undo ({controlsData.undoCount})
  </button>
</div>
```