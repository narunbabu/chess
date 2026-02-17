// src/components/play/SoundToggle.js
import React, { useState } from 'react';

const STORAGE_KEY = 'chess_sound_muted';

export const isSoundMuted = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

const SoundToggle = () => {
  const [muted, setMuted] = useState(isSoundMuted);

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // localStorage unavailable
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
      title={muted ? 'Unmute sounds' : 'Mute sounds'}
      style={{
        background: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '8px',
        width: '36px',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        fontSize: '18px',
        color: muted ? '#666' : '#bababa',
        transition: 'all 0.15s ease',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
        e.currentTarget.style.color = '#fff';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
        e.currentTarget.style.color = muted ? '#666' : '#bababa';
      }}
    >
      {muted ? '\uD83D\uDD07' : '\uD83D\uDD0A'}
    </button>
  );
};

export default SoundToggle;
