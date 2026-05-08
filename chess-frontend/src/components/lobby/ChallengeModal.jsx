import React, { useEffect, useState } from 'react';
import { getPreferredGameMode } from '../../utils/gamePreferences';

const SentCountdown = ({ invitedPlayer }) => {
  const [secondsLeft, setSecondsLeft] = useState(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCancel = () => {
    if (window.__pendingInvitationCancel?.cancel) {
      window.__pendingInvitationCancel.cancel();
    }
  };

  return (
    <>
      <h2>Waiting for {invitedPlayer?.name}...</h2>
      <p>Challenge sent. Waiting for response...</p>
      <p style={{
        fontSize: '28px',
        fontWeight: 'bold',
        color: secondsLeft <= 3 ? '#e74c3c' : '#e8a93e',
        margin: '12px 0',
      }}>
        {secondsLeft}s
      </p>
      <div style={{
        width: '100%',
        height: '4px',
        background: '#3d3a37',
        borderRadius: '2px',
        overflow: 'hidden',
        margin: '8px 0 16px',
      }}>
        <div style={{
          width: `${(secondsLeft / 10) * 100}%`,
          height: '100%',
          background: secondsLeft <= 3 ? '#e74c3c' : '#81b64c',
          transition: 'width 1s linear',
          borderRadius: '2px',
        }} />
      </div>
      <button
        onClick={handleCancel}
        style={{
          padding: '8px 24px',
          background: 'transparent',
          border: '2px solid #e74c3c',
          color: '#e74c3c',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
        }}
      >
        Cancel Challenge
      </button>
    </>
  );
};

const TIME_PRESETS = [
  { minutes: 3, increment: 1, label: '3|1', category: 'Blitz' },
  { minutes: 3, increment: 2, label: '3|2', category: 'Blitz' },
  { minutes: 5, increment: 2, label: '5|2', category: 'Blitz' },
  { minutes: 5, increment: 3, label: '5|3', category: 'Blitz' },
  { minutes: 10, increment: 0, label: '10 min', category: 'Rapid' },
  { minutes: 10, increment: 5, label: '10|5', category: 'Rapid' },
  { minutes: 15, increment: 10, label: '15|10', category: 'Rapid' },
  { minutes: 30, increment: 0, label: '30 min', category: 'Classical' },
];

const LEARNING_HELP_OPTIONS = [3, 5, 7];

const MODE_DETAILS = {
  casual: 'Undo and pause are available. No rating changes.',
  learning: 'Undo and Best share a limited helpline pool. CCT stays unlimited. Results affect Learner Elo only.',
  rated: 'No undo, no pause, and leaving counts as a loss. Results affect rating.',
};

const MODE_OPTIONS = [
  { value: 'casual', label: 'Casual', accent: '#81b64c' },
  { value: 'learning', label: 'Learning', accent: '#3fb98f' },
  { value: 'rated', label: 'Rated', accent: '#e8a93e' },
];

const COLOR_OPTIONS = [
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black' },
  { value: 'random', label: 'Random' },
];

const getModeLabel = (mode) => (
  MODE_OPTIONS.find(option => option.value === mode)?.label || 'Casual'
);

const getInvitationMetadata = (invitation) => {
  const metadata = invitation?.metadata;
  if (!metadata) return {};
  if (typeof metadata !== 'string') return metadata;

  try {
    return JSON.parse(metadata);
  } catch {
    return {};
  }
};

const getInvitationSummary = (invitation) => {
  const metadata = getInvitationMetadata(invitation);
  const mode = metadata.game_mode || invitation?.game_mode || 'casual';
  const minutes = metadata.time_control_minutes || invitation?.time_control_minutes;
  const increment = metadata.increment_seconds ?? invitation?.increment_seconds ?? 0;

  return {
    modeLabel: getModeLabel(mode),
    timeLabel: minutes ? `${minutes}+${increment}` : null,
  };
};

const ChallengeModal = ({
  showColorModal,
  selectedPlayer,
  onColorChoice,
  onCancelColorChoice,
  showResponseModal,
  selectedInvitation,
  processingInvitations,
  onAcceptWithColor,
  onCancelResponse,
  onDeclineInvitation,
  inviteStatus,
  invitedPlayer,
}) => {
  const [gameMode, setGameMode] = useState(() => getPreferredGameMode());
  const [learningHelpLimit, setLearningHelpLimit] = useState(5);
  const [timeControl, setTimeControl] = useState(10);
  const [increment, setIncrement] = useState(5);
  const [preferredColor, setPreferredColor] = useState('random');

  if (showColorModal && selectedPlayer) {
    const categories = [...new Set(TIME_PRESETS.map(p => p.category))];
    const isSyntheticChallenge = selectedPlayer.type === 'synthetic';
    const visibleModes = isSyntheticChallenge
      ? MODE_OPTIONS
      : MODE_OPTIONS.filter(option => option.value !== 'learning');
    const displayGameMode = visibleModes.some(option => option.value === gameMode)
      ? gameMode
      : 'casual';

    const submitChallenge = () => {
      onColorChoice(
        preferredColor,
        displayGameMode,
        timeControl,
        increment,
        displayGameMode === 'learning' ? learningHelpLimit : null
      );
    };

    return (
      <div className="invitation-modal">
        <div className="modal-content" style={{ maxWidth: '520px' }}>
          <h2 style={{ marginBottom: '14px' }}>Challenge {selectedPlayer.name}</h2>

          <div style={{ marginBottom: '18px', textAlign: 'left' }}>
            <p style={{ marginBottom: '8px', fontWeight: 'bold', color: '#bababa' }}>Game Mode:</p>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${visibleModes.length}, minmax(0, 1fr))`, gap: '8px' }}>
              {visibleModes.map(option => {
                const selected = displayGameMode === option.value;
                return (
                  <label
                    key={option.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      minHeight: '44px',
                      padding: '8px 6px',
                      border: `2px solid ${selected ? option.accent : '#4a4744'}`,
                      borderRadius: '8px',
                      backgroundColor: selected ? `${option.accent}26` : 'transparent',
                      color: '#fff',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '15px',
                    }}
                  >
                    <input
                      type="radio"
                      name="challenge-game-mode"
                      value={option.value}
                      checked={selected}
                      onChange={(event) => setGameMode(event.target.value)}
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
            <div style={{ marginTop: '8px', color: '#bababa', fontSize: '13px', lineHeight: 1.35 }}>
              {MODE_DETAILS[displayGameMode]}
            </div>
          </div>

          {isSyntheticChallenge && displayGameMode === 'learning' && (
            <div style={{ marginBottom: '18px', textAlign: 'left' }}>
              <p style={{ marginBottom: '8px', fontWeight: 'bold', color: '#bababa' }}>Learning Helplines:</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {LEARNING_HELP_OPTIONS.map(limit => {
                  const selected = learningHelpLimit === limit;
                  return (
                    <button
                      key={limit}
                      type="button"
                      onClick={() => setLearningHelpLimit(limit)}
                      style={{
                        minWidth: '52px',
                        padding: '8px 14px',
                        borderRadius: '18px',
                        border: `2px solid ${selected ? '#3fb98f' : '#4a4744'}`,
                        backgroundColor: selected ? 'rgba(63, 185, 143, 0.22)' : 'transparent',
                        color: selected ? '#9ce5ca' : '#bababa',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: selected ? 'bold' : 'normal',
                      }}
                    >
                      {limit}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ marginBottom: '18px', textAlign: 'left' }}>
            <p style={{ marginBottom: '8px', fontWeight: 'bold', color: '#bababa' }}>Time Control:</p>
            {categories.map(cat => (
              <div key={cat} style={{ marginBottom: '8px' }}>
                <p style={{ fontSize: '11px', color: '#8b8987', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{cat}</p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {TIME_PRESETS.filter(p => p.category === cat).map(preset => {
                    const isSelected = timeControl === preset.minutes && increment === preset.increment;
                    return (
                      <button
                        key={`${preset.minutes}-${preset.increment}`}
                        type="button"
                        onClick={() => { setTimeControl(preset.minutes); setIncrement(preset.increment); }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '16px',
                          border: `2px solid ${isSelected ? '#81b64c' : '#4a4744'}`,
                          backgroundColor: isSelected ? 'rgba(129, 182, 76, 0.2)' : 'transparent',
                          color: isSelected ? '#81b64c' : '#bababa',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: isSelected ? 'bold' : 'normal',
                        }}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: '18px', textAlign: 'left' }}>
            <p style={{ marginBottom: '8px', fontWeight: 'bold', color: '#bababa' }}>Color:</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
              {COLOR_OPTIONS.map(option => {
                const selected = preferredColor === option.value;
                return (
                  <label
                    key={option.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      minHeight: '38px',
                      padding: '7px 6px',
                      borderRadius: '8px',
                      border: `2px solid ${selected ? '#81b64c' : '#4a4744'}`,
                      backgroundColor: selected ? 'rgba(129, 182, 76, 0.18)' : 'transparent',
                      color: selected ? '#fff' : '#bababa',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: selected ? 700 : 600,
                    }}
                  >
                    <input
                      type="radio"
                      name="challenge-color"
                      value={option.value}
                      checked={selected}
                      onChange={(event) => setPreferredColor(event.target.value)}
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              type="button"
              onClick={onCancelColorChoice}
              style={{
                padding: '11px 18px',
                borderRadius: '8px',
                border: '2px solid #e74c3c',
                backgroundColor: 'rgba(231, 76, 60, 0.14)',
                color: '#ff7b72',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: 800,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitChallenge}
              style={{
                padding: '11px 18px',
                borderRadius: '8px',
                border: '2px solid #81b64c',
                backgroundColor: '#81b64c',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: 800,
              }}
            >
              Challenge
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showResponseModal && selectedInvitation) {
    const isProcessing = processingInvitations.has(selectedInvitation.id);
    const inviterColor = selectedInvitation.inviter_preferred_color;
    const invitationSummary = getInvitationSummary(selectedInvitation);

    return (
      <div className="invitation-modal">
        <div className="modal-content">
          <h2>Accept Challenge from {selectedInvitation.inviter.name}</h2>
          <p>
            {selectedInvitation.inviter.name} wants to play as{' '}
            {inviterColor === 'white' ? 'White' : 'Black'}
          </p>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            margin: '10px 0 14px',
          }}>
            <span style={{
              padding: '6px 10px',
              border: '1px solid #4a4744',
              borderRadius: '14px',
              color: '#e5e5e5',
              fontWeight: 700,
              fontSize: '13px',
            }}>
              Mode: {invitationSummary.modeLabel}
            </span>
            {invitationSummary.timeLabel && (
              <span style={{
                padding: '6px 10px',
                border: '1px solid #4a4744',
                borderRadius: '14px',
                color: '#e5e5e5',
                fontWeight: 700,
                fontSize: '13px',
              }}>
                Time: {invitationSummary.timeLabel}
              </span>
            )}
          </div>
          <p>Choose your response:</p>
          <div className="color-choices">
            <button
              className="color-choice accept"
              onClick={() => {
                const myColor = inviterColor === 'white' ? 'black' : 'white';
                onAcceptWithColor(selectedInvitation.id, myColor);
              }}
              disabled={isProcessing}
            >
              {isProcessing ? 'Accepting...' : 'Accept their choice'}
              {!isProcessing && (
                <small>
                  (You'll play as{' '}
                  {inviterColor === 'white' ? 'Black' : 'White'})
                </small>
              )}
            </button>
            <button
              className="color-choice opposite"
              onClick={() => onAcceptWithColor(selectedInvitation.id, inviterColor)}
              disabled={isProcessing}
            >
              {isProcessing
                ? 'Accepting...'
                : `Play as ${inviterColor === 'white' ? 'White' : 'Black'}`}
              {!isProcessing && <small>(swap colors)</small>}
            </button>
          </div>
          <div className="modal-actions">
            <button className="cancel-btn" onClick={onCancelResponse}>
              Cancel
            </button>
            <button
              className="decline-btn"
              onClick={() => onDeclineInvitation(selectedInvitation.id)}
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (inviteStatus && invitedPlayer) {
    return (
      <div className="invitation-modal">
        <div className="modal-content">
          {inviteStatus === 'sending' && (
            <>
              <h2>Sending Invitation...</h2>
              <p>Sending challenge to {invitedPlayer.name}...</p>
              <div className="loader"></div>
            </>
          )}
          {inviteStatus === 'sent' && (
            <SentCountdown invitedPlayer={invitedPlayer} />
          )}
          {inviteStatus === 'error' && (
            <>
              <h2>Error</h2>
              <p>
                Failed to send invitation to {invitedPlayer.name}. Please try
                again.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default ChallengeModal;
