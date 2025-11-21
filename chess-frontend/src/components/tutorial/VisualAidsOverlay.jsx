import React from 'react';

const VisualAidsOverlay = ({ visualAids, boardSize = 480 }) => {
  const { arrows = [], highlights = [], ghostPieces = [] } = visualAids;

  // Convert square coordinates to pixel positions
  const squareToPixel = (square, isArrow = false) => {
    if (!square || square.length !== 2) return { x: 0, y: 0 };

    const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = parseInt(square[1]) - 1;
    const squareSize = boardSize / 8;

    let x, y;

    if (isArrow) {
      // For arrows, center the point in the square
      x = file * squareSize + squareSize / 2;
      y = (7 - rank) * squareSize + squareSize / 2;
    } else {
      // For highlights, start from the square corner
      x = file * squareSize;
      y = (7 - rank) * squareSize;
    }

    return { x, y };
  };

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ width: boardSize, height: boardSize }}
    >
      <svg
        width={boardSize}
        height={boardSize}
        className="absolute inset-0"
        viewBox={`0 0 ${boardSize} ${boardSize}`}
        style={{ zIndex: 10 }}
      >
        {/* Highlights */}
        {highlights.map((square, index) => {
          const { x, y } = squareToPixel(square);
          const squareSize = boardSize / 8;

          return (
            <rect
              key={`highlight-${index}`}
              x={x}
              y={y}
              width={squareSize}
              height={squareSize}
              fill="rgba(59, 130, 246, 0.3)"
              stroke="rgba(59, 130, 246, 0.6)"
              strokeWidth="2"
            />
          );
        })}

        {/* Arrows */}
        {arrows.map((arrow, index) => {
          const { start: startSquare, end: endSquare, color = 'green' } = arrow;
          const startPos = squareToPixel(startSquare, true);
          const endPos = squareToPixel(endSquare, true);

          // Calculate arrow angle and length
          const angle = Math.atan2(endPos.y - startPos.y, endPos.x - startPos.x);
          const length = Math.sqrt(
            Math.pow(endPos.x - startPos.x, 2) + Math.pow(endPos.y - startPos.y, 2)
          );

          // Adjust for arrow head (leave some space at the end)
          const adjustedLength = length - 20;

          // Arrow colors
          const colors = {
            green: '#10b981',
            red: '#ef4444',
            yellow: '#f59e0b',
            blue: '#3b82f6'
          };

          const arrowColor = colors[color] || colors.green;

          return (
            <g key={`arrow-${index}`}>
              {/* Arrow line */}
              <line
                x1={startPos.x}
                y1={startPos.y}
                x2={startPos.x + Math.cos(angle) * adjustedLength}
                y2={startPos.y + Math.sin(angle) * adjustedLength}
                stroke={arrowColor}
                strokeWidth="4"
                strokeLinecap="round"
                opacity="0.8"
              />

              {/* Arrow head */}
              <polygon
                points={`
                  ${startPos.x + Math.cos(angle) * adjustedLength},
                  ${startPos.y + Math.sin(angle) * adjustedLength}
                  ${startPos.x + Math.cos(angle - 0.5) * (adjustedLength - 10)},
                  ${startPos.y + Math.sin(angle - 0.5) * (adjustedLength - 10)}
                  ${startPos.x + Math.cos(angle + 0.5) * (adjustedLength - 10)},
                  ${startPos.y + Math.sin(angle + 0.5) * (adjustedLength - 10)}
                `}
                fill={arrowColor}
                opacity="0.8"
              />
            </g>
          );
        })}

        {/* Ghost pieces (placeholder - would need actual piece images) */}
        {ghostPieces.map((piece, index) => {
          const { square, piece: pieceType, opacity = 0.3 } = piece;
          const { x, y } = squareToPixel(square);
          const squareSize = boardSize / 8;

          return (
            <text
              key={`ghost-${index}`}
              x={x + squareSize / 2}
              y={y + squareSize / 2 + squareSize / 4}
              fontSize={squareSize * 0.8}
              textAnchor="middle"
              fill="rgba(0, 0, 0, 0.3)"
              opacity={opacity}
              style={{
                fontFamily: 'Arial Unicode MS, sans-serif',
                filter: 'blur(1px)'
              }}
            >
              {getPieceSymbol(pieceType)}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

// Helper function to get Unicode chess piece symbols
const getPieceSymbol = (piece) => {
  const pieces = {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
  };
  return pieces[piece] || piece;
};

export default VisualAidsOverlay;