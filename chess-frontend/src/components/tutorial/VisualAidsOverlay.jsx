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
      className="absolute pointer-events-none"
      style={{
        width: boardSize,
        height: boardSize,
        top: 0,
        left: 0
      }}
    >
      <svg
        width={boardSize}
        height={boardSize}
        className="absolute"
        viewBox={`0 0 ${boardSize} ${boardSize}`}
        style={{
          zIndex: 10,
          top: 0,
          left: 0,
          pointerEvents: 'none'
        }}
      >
        {/* Define marker for arrowheads */}
        <defs>
          {arrows.map((arrow, index) => {
            const { color = 'green' } = arrow;
            const colors = {
              green: '#10b981',
              red: '#ef4444',
              yellow: '#f59e0b',
              blue: '#3b82f6'
            };
            const arrowColor = color.startsWith('#') || color.startsWith('rgb')
              ? color
              : (colors[color] || colors.green);

            return (
              <marker
                key={`arrowhead-${index}`}
                id={`arrowhead-${index}`}
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path
                  d="M0,0 L0,6 L9,3 z"
                  fill={arrowColor}
                  opacity="0.9"
                />
              </marker>
            );
          })}
        </defs>

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
              fill="rgba(59, 130, 246, 0.25)"
              stroke="rgba(59, 130, 246, 0.5)"
              strokeWidth="1.5"
            />
          );
        })}

        {/* Arrows */}
        {arrows.map((arrow, index) => {
          const { from: startSquare, to: endSquare, color = 'green' } = arrow;
          const startPos = squareToPixel(startSquare, true);
          const endPos = squareToPixel(endSquare, true);

          // Arrow colors - support both color names and direct color values (rgba, hex, etc)
          const colors = {
            green: '#10b981',
            red: '#ef4444',
            yellow: '#f59e0b',
            blue: '#3b82f6'
          };

          // If color is already a valid color string (rgba, hex), use it directly
          const arrowColor = color.startsWith('#') || color.startsWith('rgb')
            ? color
            : (colors[color] || colors.green);

          return (
            <line
              key={`arrow-${index}`}
              x1={startPos.x}
              y1={startPos.y}
              x2={endPos.x}
              y2={endPos.y}
              stroke={arrowColor}
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.85"
              markerEnd={`url(#arrowhead-${index})`}
            />
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