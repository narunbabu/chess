import React from "react";

const TimerDisplay = ({
  playerTime,
  computerTime,
  activeTimer,
  playerColor,
  isRunning,
  isComputerRunning,
}) => {
  // Format time as mm:ss
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const isPlayerActive = activeTimer === playerColor;
  const isComputerActive = activeTimer === (playerColor === "w" ? "b" : "w");

  return (
    <div className="space-y-2">
      {/* Player Timer */}
      <div className={`rounded-lg p-3 transition-all duration-300 ${
        isPlayerActive
          ? "bg-success/30 border border-success/50 shadow-lg scale-105"
          : "bg-white/10 border border-white/20"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">👤</span>
            <div className="flex items-center gap-1">
              {isPlayerActive && (
                <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className={`font-mono text-lg font-bold ${
              isPlayerActive ? "text-success" : "text-white"
            }`}>
              {formatTime(playerTime)}
            </div>
          </div>
        </div>
      </div>

      {/* Computer Timer */}
      <div className={`rounded-lg p-3 transition-all duration-300 ${
        isComputerActive
          ? "bg-error/30 border border-error/50 shadow-lg scale-105"
          : "bg-white/10 border border-white/20"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <div className="flex items-center gap-1">
              {isComputerActive && (
                <div className="w-2 h-2 bg-error rounded-full animate-pulse"></div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className={`font-mono text-lg font-bold ${
              isComputerActive ? "text-error" : "text-white"
            }`}>
              {formatTime(computerTime)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimerDisplay;
