import React, { useState, useRef, useEffect, useCallback } from 'react';
import './ChatPanel.css';

const formatTime = (isoString) => {
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const ChatPanel = ({ messages = [], onSend, myUserId, disabled = false }) => {
  const [text, setText] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend?.(trimmed);
    setText('');
    inputRef.current?.focus();
  }, [text, disabled, onSend]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="gc-chat-panel">
      <div className="gc-chat-messages">
        {messages.length === 0 ? (
          <div className="gc-chat-empty">No messages yet. Say hi!</div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === myUserId;
            return (
              <div key={msg.id} className={`gc-chat-msg ${isMine ? 'gc-chat-msg--mine' : 'gc-chat-msg--theirs'}`}>
                {!isMine && (
                  <span className="gc-chat-sender">{msg.sender_name}</span>
                )}
                <div className="gc-chat-bubble">{msg.message}</div>
                <span className="gc-chat-time">{formatTime(msg.created_at)}</span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="gc-chat-input-row">
        <textarea
          ref={inputRef}
          className="gc-chat-input"
          placeholder={disabled ? 'Chat unavailable' : 'Type a message…'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          maxLength={500}
          rows={1}
        />
        <button
          className="gc-chat-send-btn"
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          title="Send"
        >
          ➤
        </button>
      </div>
    </div>
  );
};

export default ChatPanel;
