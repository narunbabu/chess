import React, { useId, useMemo, useState } from 'react';
import { Chess } from 'chess.js';

const names = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
export const describeLegalMove = move => `${names[move.piece]} ${move.from} to ${move.to}${move.captured ? `, captures ${names[move.captured]}` : ''}${move.promotion ? `, promote to ${names[move.promotion]}` : ''} (${move.san})`;

// The same legal move path as the visual board; no engine hints, even in rated play.
export default function AccessibleMoveControls({ fen, disabled, onMove }) {
  const id = useId();
  const [choice, setChoice] = useState('');
  const [notice, setNotice] = useState('');
  const position = useMemo(() => { try { return new Chess(fen); } catch { return null; } }, [fen]);
  const moves = position?.moves({ verbose: true }) || [];
  const selected = moves.find(move => `${fen}|${move.from}${move.to}${move.promotion || ''}` === choice);
  return <details className="c99-accessible-moves">
    <summary>Keyboard and screen-reader moves</summary>
    <p aria-live="polite">{position ? `${position.turn() === 'w' ? 'White' : 'Black'} to move${position.isCheck() ? ' — check' : ''}.` : 'Position unavailable.'} {disabled ? 'Move entry is not available right now.' : 'Select a legal move, then confirm.'}</p>
    <form aria-label="Accessible move entry" onSubmit={async event => {
      event.preventDefault();
      if (disabled || !selected) return;
      try {
        const accepted = await onMove(selected.from, selected.to, selected.promotion || 'q');
        setNotice(accepted === false ? 'Move not accepted. Check the turn and connection, then try again.' : `Played ${describeLegalMove(selected)}.`);
        if (accepted !== false) setChoice('');
      } catch { setNotice('Move could not be sent. Check your connection and try again.'); }
    }}>
      <label htmlFor={id}>Legal move</label>
      <select id={id} disabled={disabled || !position} value={selected ? choice : ''} onChange={event => setChoice(event.target.value)}>
        <option value="">Choose a move</option>
        {moves.map(move => { const key = `${fen}|${move.from}${move.to}${move.promotion || ''}`; return <option value={key} key={key}>{describeLegalMove(move)}</option>; })}
      </select>
      <button type="submit" className="c99-primary" disabled={disabled || !selected}>Make move</button>
    </form>
    <p role="status">{notice}</p>
  </details>;
}
