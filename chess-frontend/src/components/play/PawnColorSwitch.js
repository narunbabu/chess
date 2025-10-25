import React from 'react';

export default function PawnColorSwitch({ onColorChange }) {
  return (
    <div className="pawn-color-switch">
      <button onClick={() => onColorChange('white')}>White</button>
      <button onClick={() => onColorChange('black')}>Black</button>
    </div>
  );
}