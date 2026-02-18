import React from "react";
import { truncatePlayerName, getPlayerAvatar } from '../../utils/playerDisplayUtils';

const TimerDisplay = ({
  playerTime,
  computerTime,
  activeTimer,
  playerColor,
  isRunning,
  isComputerRunning,
  mode = 'computer',
  playerData = null,
  opponentData = null,
}) => {
  const formatTime = (seconds) => {
    const totalSeconds = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const secs = (totalSeconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const isPlayerActive = activeTimer === playerColor;
  const isComputerActive = activeTimer === (playerColor === "w" ? "b" : "w");

  const renderAvatar = (data, isComputer = false) => {
    const avatarUrl = getPlayerAvatar(data) || data?.avatar_url;
    if (avatarUrl) {
      return <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0 border border-[#4a4744]" />;
    }
    if (isComputer) {
      const initial = (data?.name || 'C')[0].toUpperCase();
      return (
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-[#4a3728] text-[#f0d9b5] border border-[#6b5a48] flex-shrink-0">
          {initial}
        </div>
      );
    }
    const initial = (data?.name || 'Y')[0].toUpperCase();
    return (
      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-[#f0d9b5] text-[#4a3728] border border-[#d4b896] flex-shrink-0">
        {initial}
      </div>
    );
  };

  const getDisplayName = (data, isComputer = false, fallback = 'Player') => {
    if (isComputer) return truncatePlayerName(data?.name || 'CPU');
    return truncatePlayerName(data?.name || fallback);
  };

  const isLow = (seconds) => seconds != null && seconds < 30;
  const isCritical = (seconds) => seconds != null && seconds < 10;

  const renderTimerCard = (data, isComputer, time, isActive, isTimerRunning) => {
    const low = isLow(time);
    const critical = isCritical(time);
    const showPulse = isActive && isTimerRunning;

    return (
      <div className={`rounded-lg px-2.5 py-2 transition-all duration-300 flex-1 min-w-0
        ${isActive
          ? 'bg-[#312e2b] border-2 border-[#81b64c]/50 shadow-[0_0_6px_rgba(129,182,76,0.12)]'
          : 'bg-[#262421] border border-[#3d3a37]'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {renderAvatar(data, isComputer)}
            <div className="flex flex-col min-w-0">
              <span className={`text-[11px] font-medium truncate ${isActive ? 'text-white' : 'text-[#bababa]'}`}>
                {getDisplayName(data, isComputer, isComputer ? 'Rival' : 'You')}
              </span>
              {isActive && showPulse && (
                <div className="w-1.5 h-1.5 bg-[#81b64c] rounded-full animate-pulse mt-0.5" />
              )}
            </div>
          </div>
          <div
            className={`flex-shrink-0 px-2.5 py-1 rounded-md transition-all duration-300
              ${isActive
                ? critical
                  ? 'bg-[#c33a3a] text-white'
                  : low
                    ? 'bg-[#e8a93e]/20 text-[#e8a93e]'
                    : 'bg-[#81b64c]/15 text-white'
                : 'bg-[#1a1a18] text-[#8b8987]'
              }
              ${showPulse && !critical ? 'animate-[clock-pulse_2s_ease-in-out_infinite]' : ''}
            `}
          >
            <span className="font-mono text-sm font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(time)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex gap-1.5 sm:gap-2">
        {renderTimerCard(opponentData, mode === 'computer', computerTime, isComputerActive, isComputerRunning)}
        {renderTimerCard(playerData, false, playerTime, isPlayerActive, isRunning)}
      </div>
      <style>{`
        @keyframes clock-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(129, 182, 76, 0); }
          50% { box-shadow: 0 0 8px 2px rgba(129, 182, 76, 0.2); }
        }
      `}</style>
    </>
  );
};

export default TimerDisplay;
