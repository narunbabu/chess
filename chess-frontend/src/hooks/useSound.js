import { useCallback, useEffect, useRef } from 'react';

// Sound URLs — small audio files for chess interactions
const SOUNDS = {
  move:    '/sounds/move.mp3',
  capture: '/sounds/capture.mp3',
  check:   '/sounds/check.mp3',
  castle:  '/sounds/castle.mp3',
  end:     '/sounds/end.mp3',
  click:   '/sounds/click.mp3',
  notify:  '/sounds/notify.mp3',
};

/**
 * Hook for playing UI sounds with preloading, volume, and mute support.
 *
 * Usage:
 *   const { play } = useSound();
 *   play('move');
 *   play('capture', { volume: 0.5 });
 */
export default function useSound() {
  const audioCache = useRef({});
  const muted = useRef(false);

  // Preload common sounds on mount
  useEffect(() => {
    Object.entries(SOUNDS).forEach(([key, src]) => {
      try {
        const audio = new Audio(src);
        audio.preload = 'auto';
        audio.volume = 0.5;
        audioCache.current[key] = audio;
      } catch {
        // Silent fail — sound is non-critical
      }
    });
  }, []);

  const play = useCallback((name, opts = {}) => {
    if (muted.current) return;
    const volume = opts.volume ?? 0.5;

    try {
      const cached = audioCache.current[name];
      if (cached) {
        cached.currentTime = 0;
        cached.volume = volume;
        cached.play().catch(() => {});
      } else if (SOUNDS[name]) {
        const audio = new Audio(SOUNDS[name]);
        audio.volume = volume;
        audio.play().catch(() => {});
        audioCache.current[name] = audio;
      }
    } catch {
      // Silent fail
    }
  }, []);

  const toggleMute = useCallback(() => {
    muted.current = !muted.current;
    return muted.current;
  }, []);

  const setMuted = useCallback((val) => {
    muted.current = val;
  }, []);

  return { play, toggleMute, setMuted, isMuted: () => muted.current };
}
