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
  lessonLabels = [], // Array of numbered square labels: [{square: 'e2', label: '1', color: '#FFD700'}]
  // Keep other props even if unused locally for potential future use
  // activeTimer, setMoveCompleted, setTimerButtonColor, previousGameStateRef,
  // evaluateMove, updateGameStatus, currentTurn,
}) => {
  const boardBoxRef = useRef(null);       // <── renamed for clarity
  const [boardSize, setBoardSize] = useState(0);
  const boardSizeRef = useRef(0);          // Track current size without re-creating observer
  const resizeTimeoutRef = useRef(null);   // For debouncing resize events

  useEffect(() => {
    if (!boardBoxRef.current) return;

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const newSize = Math.floor(Math.min(width, height));

      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      resizeTimeoutRef.current = setTimeout(() => {
        // Compare against ref (always current) instead of stale closure
        if (newSize !== boardSizeRef.current && newSize > 0) {
          const prevSize = boardSizeRef.current;
          boardSizeRef.current = newSize;
          setBoardSize(newSize);
          logBoardResize(prevSize, newSize, { width, height });
        }
      }, 100); // 100ms debounce to prevent mid-interaction layout thrash
    });

    ro.observe(boardBoxRef.current);

    // Cleanup function
    return () => {
      ro.disconnect();
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []); // Empty deps: observer created once, never torn down/recreated

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

  // SVG overlay — renders arrows and numbered square labels pixel-perfectly.
  // Arrows use <marker orient="auto"> (same technique as react-chessboard).
  // Labels use <circle> + <text> centred on the origin square.
  const renderBoardOverlay = () => {
    const hasArrows = lessonArrows && lessonArrows.length > 0;
    const hasLabels = lessonLabels && lessonLabels.length > 0;
    if ((!hasArrows && !hasLabels) || boardSize <= 0) return null;

    const squareSize = boardSize / 8;

    // Convert square notation → pixel centre, respecting board orientation.
    const getSquareCenter = (square) => {
      if (!square || square.length < 2) return null;
      const fileIdx = square.charCodeAt(0) - 'a'.charCodeAt(0); // 0=a…7=h
      const rankNum = parseInt(square[1], 10);                   // 1-8
      if (isNaN(rankNum) || fileIdx < 0 || fileIdx > 7) return null;

      const isFlipped    = boardOrientation === 'black';
      const adjustedFile = isFlipped ? 7 - fileIdx : fileIdx;
      const adjustedRank = isFlipped ? rankNum - 1 : 8 - rankNum; // 0 = top row

      return {
        x: adjustedFile * squareSize + squareSize / 2,
        y: adjustedRank * squareSize + squareSize / 2,
      };
    };

    const strokeWidth = boardSize / 40; // scales with board size
    const REDUCER     = boardSize / 32; // shorten line so marker tip lands on target centre

    // ── Arrows ───────────────────────────────────────────────────────────────
    const validArrows = (lessonArrows || []).filter(a => a && a.from && a.to);

    const arrowDefs = validArrows.map((a, i) => {
      const color = a.color || 'rgba(255,0,0,0.7)';
      return (
        <marker
          key={`m-${i}`}
          id={`cct-arrowhead-${i}`}
          markerWidth="2"
          markerHeight="2.5"
          refX="1.25"
          refY="1.25"
          orient="auto"
        >
          <polygon points="0.3 0, 2 1.25, 0.3 2.5" fill={color} />
        </marker>
      );
    });

    const arrowLines = validArrows
      .map((a, i) => {
        const from = getSquareCenter(a.from);
        const to   = getSquareCenter(a.to);
        if (!from || !to) return null;

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const r  = Math.hypot(dx, dy);
        if (r < 1) return null;

        const end = {
          x: from.x + (dx * (r - REDUCER)) / r,
          y: from.y + (dy * (r - REDUCER)) / r,
        };

        return (
          <line
            key={`cct-arrow-${i}`}
            x1={from.x} y1={from.y}
            x2={end.x}  y2={end.y}
            stroke={a.color || 'rgba(255,0,0,0.7)'}
            strokeWidth={strokeWidth}
            opacity="0.75"
            markerEnd={`url(#cct-arrowhead-${i})`}
          />
        );
      })
      .filter(Boolean);

    // ── Numbered labels ───────────────────────────────────────────────────────
    const labelRadius   = squareSize * 0.27;  // circle radius
    const labelFontSize = squareSize * 0.30;  // text size

    const labelElements = (lessonLabels || [])
      .map((lbl, i) => {
        const center = getSquareCenter(lbl.square);
        if (!center) return null;
        const color = lbl.color || '#FFD700';
        return (
          <g key={`lbl-${i}`}>
            {/* Solid background circle */}
            <circle
              cx={center.x}
              cy={center.y}
              r={labelRadius}
              fill={color}
              opacity="0.92"
            />
            {/* Rank number */}
            <text
              x={center.x}
              y={center.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={labelFontSize}
              fontWeight="bold"
              fontFamily="Arial, sans-serif"
              fill="#1a1a1a"
            >
              {lbl.label}
            </text>
          </g>
        );
      })
      .filter(Boolean);

    if (arrowLines.length === 0 && labelElements.length === 0) return null;

    return (
      <svg
        width={boardSize}
        height={boardSize}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <defs>{arrowDefs}</defs>
        {arrowLines}
        {/* Labels rendered on top of arrows */}
        {labelElements}
      </svg>
    );
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
            {/* Render arrows and numbered labels on top of the board */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
              {renderBoardOverlay()}
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
