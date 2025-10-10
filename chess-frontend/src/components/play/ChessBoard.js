// src/components/play/ChessBoard.js
import React, { useEffect, useState, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from 'chess.js'; // Import the Chess class

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
  playerColor,
  isReplayMode,
  // Keep other props even if unused locally for potential future use
  // activeTimer, setMoveCompleted, setTimerButtonColor, previousGameStateRef,
  // evaluateMove, updateGameStatus, currentTurn,
}) => {
  const boardBoxRef = useRef(null);       // <── renamed for clarity
  const [boardSize, setBoardSize] = useState(0);
  const resizeTimeoutRef = useRef(null);  // For debouncing resize events

  useEffect(() => {
    if (!boardBoxRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      /* 15 px padding above & below for safety */
      const { width, height } = entry.contentRect;
      // Use the smaller dimension to ensure square board fits within container
      const newSize = Math.floor(Math.min(width, height));

      // Debug logging to track size changes
      console.log(`🎯 ChessBoard ResizeObserver triggered:`, {
        containerWidth: width,
        containerHeight: height,
        calculatedSize: newSize,
        currentBoardSize: boardSize,
        sizeChanged: newSize !== boardSize
      });

      // Debounce rapid resize events to prevent flickering
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      resizeTimeoutRef.current = setTimeout(() => {
        // Only update if size actually changed (prevent unnecessary re-renders)
        if (newSize !== boardSize && newSize > 0) {
          console.log(`📐 Setting new board size: ${boardSize} → ${newSize}`);
          setBoardSize(newSize);
        }
      }, 50); // 50ms debounce to prevent rapid recalculations
    });
    ro.observe(boardBoxRef.current);
    return () => {
      ro.disconnect();
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // Helper to check if the game prop is a valid Chess instance
  const isValidChessInstance = (g) => g && g instanceof Chess;

  const getMoveOptions = (square) => {
    // Add instance check
    if (!isValidChessInstance(game)) {
        console.warn("ChessBoard: Invalid game object received in getMoveOptions.");
        return false;
    }

    const moves = game.moves({ square, verbose: true });
    if (moves.length === 0) {
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

  // Ensure game object is valid before accessing methods like turn()
  // Add instance check
  const isPlayerTurn = isValidChessInstance(game) && game.turn() === playerColor;

  const onSquareClick = (square) => {
    // Add instance check
    if (!isValidChessInstance(game) || isReplayMode || !isPlayerTurn) {
        // Prevent interaction if not player's turn, in replay, or invalid game object
        if (!isValidChessInstance(game)) console.warn("ChessBoard: Invalid game object received in onSquareClick.");
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
        // Add instance check before game.turn()
        if (pieceOnSquare && isValidChessInstance(game) && pieceOnSquare.color === game.turn()) {
            // Select the piece if it's the player's color and their turn
            const options = getMoveOptions(square); // getMoveOptions already checks instance
            setMoveSquares(options || {}); // Update visual options
            return options !== false;
        } else {
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
  const customSquareStyles = { ...moveSquares, ...rightClickedSquares };

  return(
    <div ref={boardBoxRef} className="w-full h-full">
      <div className="w-full h-full flex items-center justify-center">
        {/* Add instance check before rendering Chessboard */}
        {isValidChessInstance(game) && boardSize > 0 ? (
          <Chessboard
            position={game.fen()}
            boardWidth={boardSize}
            boardOrientation={boardOrientation}
            onPieceDrop={onDrop}
            onSquareClick={onSquareClick}
            onSquareRightClick={onSquareRightClick}
            customSquareStyles={customSquareStyles}
            animationDuration={200}
            arePiecesDraggable={!isReplayMode && isPlayerTurn}
          />
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
