// src/components/play/GameChat.js
// In-game chat for computer games with synthetic opponent responses

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { QUICK_MESSAGES, EMOJI_REACTIONS } from '../../utils/syntheticChatUtils';
import { isSoundMuted } from './SoundToggle';

const PING_COOLDOWN_MS = 30000;
const PING_SHOW_DELAY_MS = 5000;

const GameChat = ({
  messages = [],
  opponentName = 'Opponent',
  isOpponentThinking = false,
  gameOver = false,
  gameStarted = false,
  onSendMessage,
  onPing,
}) => {
  const messagesEndRef = useRef(null);
  const lastPingTimeRef = useRef(0);
  const thinkingStartRef = useRef(null);
  const [canPing, setCanPing] = useState(false);
  const [pingCooldown, setPingCooldown] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [floatingReaction, setFloatingReaction] = useState(null);
  const [customText, setCustomText] = useState('');

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Track when opponent starts thinking to show ping button after delay
  useEffect(() => {
    if (isOpponentThinking) {
      thinkingStartRef.current = Date.now();
      const timer = setTimeout(() => setCanPing(true), PING_SHOW_DELAY_MS);
      return () => clearTimeout(timer);
    } else {
      thinkingStartRef.current = null;
      setCanPing(false);
    }
  }, [isOpponentThinking]);

  const handlePing = useCallback(() => {
    const now = Date.now();
    if (now - lastPingTimeRef.current < PING_COOLDOWN_MS) return;
    lastPingTimeRef.current = now;
    setPingCooldown(true);
    setTimeout(() => setPingCooldown(false), PING_COOLDOWN_MS);

    // Play alert sound
    if (!isSoundMuted()) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        gain.gain.value = 0.15;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.stop(ctx.currentTime + 0.3);
      } catch (e) { /* audio not available */ }
    }

    if (onPing) onPing();
  }, [onPing]);

  const handleQuickMessage = useCallback((msg) => {
    if (onSendMessage) onSendMessage(msg, 'message');
  }, [onSendMessage]);

  const handleEmojiReaction = useCallback((emoji) => {
    setFloatingReaction(emoji);
    setTimeout(() => setFloatingReaction(null), 1500);
    setShowEmoji(false);
    if (onSendMessage) onSendMessage(emoji, 'emoji');
  }, [onSendMessage]);

  if (!gameStarted) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: '13px' }}>
      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px',
        minHeight: 0,
        position: 'relative',
      }}>
        {messages.length === 0 && (
          <div style={{ color: '#6b6966', textAlign: 'center', padding: '16px 8px', fontSize: '12px' }}>
            Send a message or emoji to {opponentName}
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              marginBottom: '6px',
              padding: '4px 8px',
              borderRadius: '6px',
              background: msg.type === 'system' ? 'transparent' : (msg.isPlayer ? '#2a3a2a' : '#3a2a2a'),
              borderLeft: msg.type === 'system' ? 'none' : `2px solid ${msg.isPlayer ? '#81b64c' : '#e8a93e'}`,
            }}
          >
            {msg.type === 'system' ? (
              <span style={{ color: '#6b6966', fontStyle: 'italic', fontSize: '11px' }}>{msg.message}</span>
            ) : msg.type === 'emoji' ? (
              <div>
                <span style={{ color: msg.isPlayer ? '#81b64c' : '#e8a93e', fontSize: '11px', fontWeight: 600 }}>
                  {msg.sender}
                </span>
                <span style={{ fontSize: '20px', marginLeft: '6px' }}>{msg.message}</span>
              </div>
            ) : (
              <div>
                <span style={{ color: msg.isPlayer ? '#81b64c' : '#e8a93e', fontSize: '11px', fontWeight: 600 }}>
                  {msg.sender}
                </span>
                <div style={{ color: '#d4d0cc', marginTop: '2px' }}>{msg.message}</div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />

        {/* Floating emoji reaction */}
        {floatingReaction && (
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '40px',
            animation: 'floatUp 1.5s ease-out forwards',
            pointerEvents: 'none',
          }}>
            {floatingReaction}
          </div>
        )}
      </div>

      {/* Ping button — shown when opponent is thinking for too long */}
      {canPing && isOpponentThinking && !gameOver && (
        <button
          onClick={handlePing}
          disabled={pingCooldown}
          style={{
            margin: '4px 8px',
            padding: '6px 12px',
            borderRadius: '6px',
            border: 'none',
            background: pingCooldown ? '#3d3a37' : '#e8a93e',
            color: pingCooldown ? '#6b6966' : '#1a1a18',
            fontWeight: 600,
            fontSize: '12px',
            cursor: pingCooldown ? 'default' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {pingCooldown ? '⏳ Ping sent' : `🔔 Nudge ${opponentName}`}
        </button>
      )}

      {/* Quick messages */}
      {!gameOver && (
        <div style={{ padding: '4px 8px', borderTop: '1px solid #3d3a37' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
            {QUICK_MESSAGES.map((msg) => (
              <button
                key={msg}
                onClick={() => handleQuickMessage(msg)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '12px',
                  border: '1px solid #4a4744',
                  background: 'transparent',
                  color: '#bababa',
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { e.target.style.background = '#3d3a37'; e.target.style.color = '#fff'; }}
                onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#bababa'; }}
              >
                {msg}
              </button>
            ))}
          </div>

          {/* Text input + emoji row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="text"
              value={customText}
              onChange={e => setCustomText(e.target.value.slice(0, 80))}
              onKeyDown={e => {
                if (e.key === 'Enter' && customText.trim()) {
                  onSendMessage?.(customText.trim(), 'message');
                  setCustomText('');
                }
              }}
              placeholder="Type a message..."
              maxLength={80}
              style={{
                flex: 1,
                padding: '5px 8px',
                borderRadius: '6px',
                border: '1px solid #4a4744',
                background: '#1e1c1a',
                color: '#d4d0cc',
                fontSize: '12px',
                outline: 'none',
                minWidth: 0,
              }}
            />
            <button
              onClick={() => {
                if (customText.trim()) {
                  onSendMessage?.(customText.trim(), 'message');
                  setCustomText('');
                }
              }}
              disabled={!customText.trim()}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: 'none',
                background: customText.trim() ? '#81b64c' : '#3d3a37',
                color: customText.trim() ? '#fff' : '#6b6966',
                fontSize: '12px',
                fontWeight: 600,
                cursor: customText.trim() ? 'pointer' : 'default',
              }}
            >
              Send
            </button>
            <button
              onClick={() => setShowEmoji(!showEmoji)}
              style={{
                padding: '3px 6px',
                borderRadius: '6px',
                border: '1px solid #4a4744',
                background: showEmoji ? '#3d3a37' : 'transparent',
                color: '#bababa',
                fontSize: '14px',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              😀
            </button>
          </div>
          {showEmoji && (
            <div style={{ display: 'flex', gap: '2px', marginTop: '4px' }}>
              {EMOJI_REACTIONS.map((r) => (
                <button
                  key={r.emoji}
                  onClick={() => handleEmojiReaction(r.emoji)}
                  title={r.label}
                  style={{
                    padding: '2px 4px',
                    border: 'none',
                    background: 'transparent',
                    fontSize: '18px',
                    cursor: 'pointer',
                    transition: 'transform 0.15s',
                  }}
                  onMouseEnter={e => { e.target.style.transform = 'scale(1.3)'; }}
                  onMouseLeave={e => { e.target.style.transform = 'scale(1)'; }}
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Float-up animation */}
      <style>{`
        @keyframes floatUp {
          0% { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-60px); }
        }
      `}</style>
    </div>
  );
};

export default GameChat;
