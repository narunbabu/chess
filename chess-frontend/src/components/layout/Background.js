
import React from 'react';

// SVG Chess Piece Components
const ChessKing = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C11.45 2 11 2.45 11 3V4H10C9.45 4 9 4.45 9 5S9.45 6 10 6H11V7C10.45 7 10 7.45 10 8S10.45 9 11 9H13C13.55 9 14 8.55 14 8S13.55 7 13 7V6H14C14.55 6 15 5.55 15 5S14.55 4 14 4H13V3C13 2.45 12.55 2 12 2M7.5 10C6.67 10 6 10.67 6 11.5V12.5C6 13.33 6.67 14 7.5 14H8.5L9 20H15L15.5 14H16.5C17.33 14 18 13.33 18 12.5V11.5C18 10.67 17.33 10 16.5 10H7.5Z"/>
  </svg>
);

const ChessQueen = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 14L3 15V16L4 17H20L21 16V15L20 14L18.5 7L17 6H16L14.5 7.5L12 5L9.5 7.5L8 6H7L5.5 7L4 14M6 16L7 10H8L9.5 11.5L12 9L14.5 11.5L16 10H17L18 16H6Z"/>
  </svg>
);

const ChessRook = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5 20H19V17H5V20M5 16H19L18 8H17V6H15V8H13V6H11V8H9V6H7V8H6L5 16Z"/>
  </svg>
);

const ChessBishop = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5 20H19V17H5V20M12 7C11.45 7 11 6.55 11 6S11.45 5 12 5 13 5.45 13 6 12.55 7 12 7M7.5 8L8 16H16L16.5 8C15.97 8.16 15.38 8.16 14.86 8H13.5L12 3L10.5 8H9.14C8.62 8.16 8.03 8.16 7.5 8Z"/>
  </svg>
);

const ChessKnight = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5 20H19V17H5V20M15 8C15 8 15 6 13 6S11 6 11 6C11 6 11 6 10 6S9 6 9 7V9L10 10L8 16H16L15 10L16 9V8C16 8 15 8 15 8Z"/>
  </svg>
);

const ChessPawn = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5 20H19V17H5V20M12 6C13.1 6 14 6.9 14 8S13.1 10 12 10 10 8.9 10 8 10.9 6 12 6M8 16H16L15 13H9L8 16Z"/>
  </svg>
);

// Floating Chess Piece Component
const FloatingChessPiece = ({ Piece, delay = 0, duration = 6, style = {} }) => (
  <div
    className="absolute animate-pulse"
    style={{
      animation: `float ${duration}s infinite ease-in-out`,
      animationDelay: `${delay}s`,
      color: '#769656',
      ...style
    }}
  >
    <Piece className="w-12 h-12" />
  </div>
);

const Background = () => {
  return (
    <div data-page="landing" className="fixed inset-0 w-screen h-screen bg-gradient-to-br from-[#1a1a18] via-[#262421] to-[#262421] font-display overflow-hidden">
      {/* Chess Board Pattern Background */}
      <div className="absolute inset-0" style={{ opacity: 0.08 }}>
        <div className="grid grid-cols-8 grid-rows-8 h-full">
          {Array.from({ length: 64 }, (_, i) => (
            <div
              key={i}
              style={{
                backgroundColor: (Math.floor(i / 8) + i) % 2 === 0 ? '#769656' : 'transparent'
              }}
            />
          ))}
        </div>
      </div>

      {/* Floating Chess Pieces Background */}
      <FloatingChessPiece Piece={ChessKing} delay={0} style={{ top: '15%', left: '8%', opacity: 0.2 }} />
      <FloatingChessPiece Piece={ChessQueen} delay={1.5} style={{ top: '25%', right: '12%', opacity: 0.25 }} />
      <FloatingChessPiece Piece={ChessRook} delay={3} style={{ top: '65%', left: '6%', opacity: 0.18 }} />
      <FloatingChessPiece Piece={ChessBishop} delay={4.5} style={{ top: '75%', right: '10%', opacity: 0.22 }} />
      <FloatingChessPiece Piece={ChessKnight} delay={2} style={{ top: '45%', right: '8%', opacity: 0.2 }} />
      <FloatingChessPiece Piece={ChessPawn} delay={6} style={{ top: '85%', left: '85%', opacity: 0.15 }} />
    </div>
  );
};

export default Background;
