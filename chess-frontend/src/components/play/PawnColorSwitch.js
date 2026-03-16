import React from 'react';

export default function PawnColorSwitch({ onColorChange }) {
  return (
    <div className="pawn-color-switch">
      <button className="btn-primary" onClick={() => onColorChange('white')}>White</button>
      <button className="btn-primary" onClick={() => onColorChange('black')}>Black</button>
    </div>
  );
}