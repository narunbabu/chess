import React, { useState, useRef, useEffect, useCallback } from 'react';
import BlockOutlined from '@mui/icons-material/BlockOutlined';
import ReportProblemOutlined from '@mui/icons-material/ReportProblemOutlined';
import SendRounded from '@mui/icons-material/SendRounded';
import './ChatPanel.css';

const formatTime = (isoString) => {
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const DISABLED_REASONS = {
  account_disabled: 'Chat is disabled for this account.',
  organization_disabled: 'Chat is disabled by your organization.',
  blocked: 'Chat is blocked between these players.',
};

const ChatPanel = ({
  messages = [],
  onSend,
  myUserId,
  disabled = false,
  policy = null,
  notice = '',
  onReport,
  onBlock,
}) => {
  const [text, setText] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const chatEnabled = policy?.enabled !== false && !disabled;
  const presetOnly = !!policy?.preset_only;
  const disabledReason = policy?.enabled === false
    ? (DISABLED_REASONS[policy.reason] || 'Chat is unavailable.')
    : disabled
      ? 'Chat is unavailable while reconnecting.'
      : '';
  const presetMessages = policy?.preset_messages || [];
  const emojiMessages = policy?.emoji_messages || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSendValue = useCallback((value) => {
    const trimmed = value.trim();
    if (!trimmed || !chatEnabled) return;
    onSend?.(trimmed);
    setText('');
    inputRef.current?.focus();
  }, [chatEnabled, onSend]);

  const handleSend = useCallback(() => {
    handleSendValue(text);
  }, [handleSendValue, text]);

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
                <div className="gc-chat-meta">
                  <span className="gc-chat-time">{formatTime(msg.created_at)}</span>
                  {msg.filtered && <span className="gc-chat-filtered">filtered</span>}
                </div>
                {!isMine && (onReport || onBlock) && (
                  <div className="gc-chat-actions">
                    {onReport && (
                      <button
                        type="button"
                        className="gc-chat-action-btn"
                        onClick={() => onReport(msg)}
                        title="Report message"
                      >
                        <ReportProblemOutlined fontSize="inherit" />
                      </button>
                    )}
                    {onBlock && msg.sender_id && (
                      <button
                        type="button"
                        className="gc-chat-action-btn"
                        onClick={() => onBlock(msg.sender_id)}
                        title="Block player"
                      >
                        <BlockOutlined fontSize="inherit" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {(notice || disabledReason) && (
        <div className={`gc-chat-notice ${disabledReason ? 'gc-chat-notice--blocked' : ''}`}>
          {notice || disabledReason}
        </div>
      )}

      {presetOnly && chatEnabled && (
        <div className="gc-chat-presets">
          <div className="gc-chat-preset-grid">
            {presetMessages.map((phrase) => (
              <button
                key={phrase}
                type="button"
                className="gc-chat-preset-btn"
                onClick={() => handleSendValue(phrase)}
              >
                {phrase}
              </button>
            ))}
          </div>
          <div className="gc-chat-emoji-row">
            {emojiMessages.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="gc-chat-emoji-btn"
                onClick={() => handleSendValue(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {!presetOnly && (
        <div className="gc-chat-input-row">
          <textarea
            ref={inputRef}
            className="gc-chat-input"
            placeholder={chatEnabled ? 'Type a message...' : 'Chat unavailable'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!chatEnabled}
            maxLength={policy?.max_length || 500}
            rows={1}
          />
          <button
            className="gc-chat-send-btn"
            onClick={handleSend}
            disabled={!chatEnabled || !text.trim()}
            title="Send"
          >
            <SendRounded fontSize="small" />
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatPanel;
