// src/components/play/ChessBoard.js
import React, { useEffect, useState, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from 'chess.js'; // Import the Chess class
import './ChessBoard.css'; // Import custom chess board styling
import { logBoardResize, logTurnChange, logPieceSelection, monitorPerformance } from '../../utils/devLogger';
import { getTheme } from '../../config/boardThemes';

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
  lastMoveHighlights = {},
  playerColor,
  isReplayMode,
  allowAllMoves = false, // Prop to allow all moves regardless of turn (for interactive practice)
  boardTheme = 'classic', // Board color theme key
  customPieces, // Custom piece renderers (e.g. 3D pieces from pieces3d.js)
  // Interactive lesson props
  lessonArrows = [], // Array of arrows: [{from: 'e2', to: 'e4', color: 'red'}]
  lessonHighlights = [], // Array of highlighted squares: [{square: 'e2', type: 'move'|'target'}]
  // Keep other props even if unused locally for potential future use
  // activeTimer, setMoveCompleted, setTimerButtonColor, previousGameStateRef,
  // evaluateMove, updateGameStatus, currentTurn,
}) => {
  const boardBoxRef = useRef(null);       // <── renamed for clarity
  const [boardSize, setBoardSize] = useState(0);
  const resizeTimeoutRef = useRef(null);  // For debouncing resize events

  useEffect(() => {
    if (!boardBoxRef.current) return;

    // Store the current board size to compare with new sizes
    const currentSize = boardSize;

    const ro = new ResizeObserver(([entry]) => {
      /* 15 px padding above & below for safety */
      const { width, height } = entry.contentRect;
      // Use the smaller dimension to ensure square board fits within container
      const newSize = Math.floor(Math.min(width, height));

      // Debounce rapid resize events to prevent flickering
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      resizeTimeoutRef.current = setTimeout(() => {
        // Only update if size actually changed and is valid (prevent unnecessary re-renders)
        if (newSize !== currentSize && newSize > 0) {
          setBoardSize(newSize);
          logBoardResize(currentSize, newSize, { width, height });
        }
      }, 50); // 50ms debounce to prevent rapid recalculations
    });

    ro.observe(boardBoxRef.current);

    // Cleanup function
    return () => {
      ro.disconnect();
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [boardSize]); // Add boardSize dependency to prevent re-creating observer on every render

  // Helper to check if the game prop is a valid Chess instance
  const isValidChessInstance = (g) => g && g instanceof Chess;

  const getMoveOptions = (square) => {
    // Add instance check
    if (!isValidChessInstance(game)) {
        console.warn("ChessBoard: Invalid game object received in getMoveOptions.");
        return false;
    }

    const piece = game.get(square);
    const currentTurn = game.turn();

    console.log('🎯 [ChessBoard] Getting move options:', {
        square,
        piece,
        currentTurn,
        playerColor,
        playerColorChess: playerColor === 'white' || playerColor === 'w' ? 'w' : 'b',
        isPlayerTurn
    });

    const moves = game.moves({ square, verbose: true });
    console.log('♟️ [ChessBoard] Available moves for', square, ':', moves);

    if (moves.length === 0) {
      console.log('❌ [ChessBoard] No moves available for', square);
      setMoveFrom("");
      return false;
    }

    const newSquares = {};
    moves.forEach((move) => {
      const pieceOnTarget = game.get(move.to);
      newSquares[move.to] = {
        background:
          pieceOnTarget && pieceOnTarget.color !== game.get(square)?.color
            ? "radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)"
            : "radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)",
        borderRadius: "50%",
      };
    });
    newSquares[square] = { background: "rgba(255, 255, 0, 0.4)" };
    setMoveFrom(square); // Set moveFrom only after confirming there are moves
    return newSquares;
  };

  // Convert playerColor to chess.js format for comparison
  // playerColor might already be in chess.js format ('w' or 'b') or full format ('white' or 'black')
  const playerColorChess = playerColor === 'white' || playerColor === 'w' ? 'w' : 'b';

  // Ensure game object is valid before accessing methods like turn()
  // Add instance check
  const isPlayerTurn = allowAllMoves || (isValidChessInstance(game) && game.turn() === playerColorChess);

  // Only log turn changes to reduce console spam
  logTurnChange({
    isPlayerTurn,
    allowAllMoves,
    validGame: isValidChessInstance(game),
    gameTurn: isValidChessInstance(game) ? game.turn() : 'invalid',
    playerColor,
    playerColorChess: playerColor === 'white' || playerColor === 'w' ? 'w' : 'b'
  });

  const onSquareClick = (square) => {
    // Add instance check
    if (!isValidChessInstance(game) || isReplayMode || !isPlayerTurn) {
        // Prevent interaction if not player's turn, in replay, or invalid game object
        logPieceSelection('reject', {
            square,
            validGame: isValidChessInstance(game),
            isReplayMode,
            isPlayerTurn,
            currentTurn: isValidChessInstance(game) ? game.turn() : 'invalid',
            playerColor,
            playerColorChess: playerColor === 'white' || playerColor === 'w' ? 'w' : 'b'
        });
        if (!isValidChessInstance(game)) logPieceSelection('reject', "Invalid game object received in onSquareClick.");
        setMoveFrom("");
        setMoveSquares({});
        return false;
    }

    setRightClickedSquares({});

    // Instance check already done for isPlayerTurn, but double-check before game.get
    if (!isValidChessInstance(game)) return false;

    const pieceOnSquare = game.get(square);

    // If no piece is selected yet, or clicking the same piece again
    if (!moveFrom || moveFrom === square) {
        logPieceSelection('attempt', {
            square,
            pieceOnSquare,
            moveFrom,
            currentTurn: isValidChessInstance(game) ? game.turn() : 'invalid',
            playerColor,
            playerColorChess: playerColor === 'white' || playerColor === 'w' ? 'w' : 'b'
        });

        // Add instance check before game.turn()
        if (pieceOnSquare && isValidChessInstance(game) && pieceOnSquare.color === game.turn()) {
            logPieceSelection('select', { square, piece: pieceOnSquare });
            // Select the piece if it's the player's color and their turn
            const options = getMoveOptions(square); // getMoveOptions already checks instance
            setMoveSquares(options || {}); // Update visual options
            return options !== false;
        } else {
            logPieceSelection('reject', {
                square,
                hasPiece: !!pieceOnSquare,
                pieceColor: pieceOnSquare?.color,
                turnMatch: pieceOnSquare?.color === (isValidChessInstance(game) ? game.turn() : 'invalid'),
                playerColorChess: playerColor === 'white' || playerColor === 'w' ? 'w' : 'b'
            });
            // Clicked on empty square or opponent's piece without a source selected
            setMoveFrom("");
            setMoveSquares({});
            return false;
        }
    }

    // A piece is already selected (moveFrom is set), try to move
    // Add instance check before game.turn()
    if (pieceOnSquare && isValidChessInstance(game) && pieceOnSquare.color === game.turn()) {
        // Clicked on another of own pieces - switch selection
        const options = getMoveOptions(square); // getMoveOptions already checks instance
        setMoveSquares(options || {});
        return options !== false;
    } else {
        // Clicked on target square (empty or opponent's piece)
        // Attempt the move via onDrop (which handles game logic)
        const moveSuccessful = onDrop(moveFrom, square);
        // Reset selection regardless of success, onDrop handles state update
        setMoveFrom("");
        setMoveSquares({});
        return moveSuccessful;
    }
  };


  const onSquareRightClick = (square) => {
    if (isReplayMode) return;
    const color = "rgba(0, 0, 255, 0.4)";
    setRightClickedSquares({
      ...rightClickedSquares,
      [square]:
        rightClickedSquares[square] &&
        rightClickedSquares[square].backgroundColor === color
          ? undefined
          : { backgroundColor: color },
    });
  };

  // Highlight king if in check
  let checkSquares = {};
  // Add instance check before calling game methods
  // Added extra check for 'game' being truthy before calling methods
  if (game && isValidChessInstance(game) && game.inCheck()) {
    game.board().forEach((row, rankIdx) => {
      row.forEach((sq, fileIdx) => {
        // Add instance check before game.turn()
        if (sq && sq.type === "k" && game && isValidChessInstance(game) && sq.color === game.turn()) {
          const file = "abcdefgh"[fileIdx];
          const rank = 8 - rankIdx;
          const squareName = `${file}${rank}`;
          checkSquares[squareName] = { background: "rgba(255,0,0,0.4)" };
        }
      });
    });
  }

  // Function to render arrows for interactive lessons
  const renderArrows = () => {
    if (!lessonArrows || lessonArrows.length === 0 || boardSize <= 0) return null;

    try {
      return lessonArrows.map((arrow, index) => {
        // Validate arrow data
        if (!arrow || !arrow.from || !arrow.to) {
          console.warn('Invalid arrow data:', arrow);
          return null;
        }

        const squareSize = boardSize / 8;

        // Convert square notation to coordinates
        const getSquareCenter = (square) => {
          if (!square || square.length < 2) return { x: 0, y: 0 };

          const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
          const rankNum = parseInt(square[1], 10);
          const rank = 8 - (isNaN(rankNum) ? 0 : rankNum);
          const x = file * squareSize + squareSize / 2;
          const y = rank * squareSize + squareSize / 2;
          return { x, y };
        };

        const from = getSquareCenter(arrow.from);
        const to = getSquareCenter(arrow.to);

        // Calculate arrow properties
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        // Adjust arrow end position to not overlap with target square
        const adjustedLength = Math.max(0, length - squareSize * 0.15);

        const arrowColor = arrow.color || 'rgba(255, 0, 0, 0.7)';

        return (
          <div key={`arrow-${index}`} className="arrow-overlay">
            {/* Arrow line */}
            <div
              className="arrow-line"
              style={{
                backgroundColor: arrowColor,
                left: `${from.x}px`,
                top: `${from.y}px`,
                width: `${adjustedLength}px`,
                transform: `rotate(${angle}deg)`,
                transformOrigin: 'left center'
              }}
            />
            {/* Arrow head */}
            <div
              className="arrow-head"
              style={{
                borderColor: `transparent ${arrowColor} transparent transparent`,
                left: `${from.x + adjustedLength - 8}px`,
                top: `${from.y - 8}px`,
                transform: `rotate(${angle}deg)`
              }}
            />
          </div>
        );
      }).filter(Boolean); // Remove null entries
    } catch (error) {
      console.error('Error rendering arrows:', error);
      return null;
    }
  };

  // Process lesson highlights
  const getLessonHighlightStyles = () => {
    const styles = {};
    try {
      if (lessonHighlights && Array.isArray(lessonHighlights)) {
        lessonHighlights.forEach(highlight => {
          if (highlight && highlight.square) {
            const isTarget = highlight.type === 'target';
            styles[highlight.square] = {
              background: isTarget ? 'rgba(255, 165, 0, 0.3)' : 'rgba(0, 255, 0, 0.3)',
              boxShadow: isTarget ? 'inset 0 0 10px rgba(255, 165, 0, 0.5)' : 'inset 0 0 10px rgba(0, 255, 0, 0.5)'
            };
          }
        });
      }
    } catch (error) {
      console.error('Error processing lesson highlights:', error);
    }
    return styles;
  };

  // Combine all custom square styles
  // Order matters: later styles override earlier ones
  const allCustomStyles = {
    ...lastMoveHighlights,      // Base layer: last move highlights
    ...getLessonHighlightStyles(), // Lesson highlights
    ...rightClickedSquares,     // User annotations
    ...checkSquares,            // King in check
    ...moveSquares,             // Top priority: legal moves when piece selected
  };

  return(
    <div ref={boardBoxRef} className="w-full h-full">
      <div className="w-full h-full flex items-center justify-center relative">
        {/* Add instance check before rendering Chessboard */}
        {isValidChessInstance(game) && boardSize > 0 ? (
          <div className="relative">
            <Chessboard
              position={game.fen()}
              boardWidth={boardSize}
              boardOrientation={boardOrientation}
              onPieceDrop={onDrop}
              onSquareClick={onSquareClick}
              onSquareRightClick={onSquareRightClick}
              customSquareStyles={allCustomStyles}
              animationDuration={200}
              arePiecesDraggable={!isReplayMode && isPlayerTurn}
              customDarkSquareStyle={{ backgroundColor: getTheme(boardTheme).dark }}
              customLightSquareStyle={{ backgroundColor: getTheme(boardTheme).light }}
              customBoardStyle={{
                borderRadius: '8px',
                overflow: 'hidden'
              }}
              {...(customPieces ? { customPieces } : {})}
            />
            {/* Render arrows on top of the board */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
              {renderArrows()}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center text-red-500 p-4 border border-red-500 rounded">
            {!isValidChessInstance(game) ? 'Invalid game state' : 'Loading board...'}
          </div>
        )}
      </div>
    </div>
  );
    
  
};

export default ChessBoard;
