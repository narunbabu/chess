import React from "react";

const TimerDisplay = ({
  playerTime,
  computerTime,
  activeTimer,
  playerColor,
}) => {
  // Format time as mm:ss
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  return (
    <div
      className="timer-container"
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: "10px",
        width: "100%",
        maxWidth: "600px",
      }}
    >
      <div
        className={`player-timer ${
          activeTimer === playerColor ? "active-timer" : ""
        }`}
        style={{
          padding: "8px 16px",
          borderRadius: "4px",
          backgroundColor: activeTimer === playerColor ? "#ffecb3" : "#e0e0e0",
        }}
      >
        Your Time: {formatTime(playerTime)}
      </div>
      <div
        className={`computer-timer ${
          activeTimer === (playerColor === "w" ? "b" : "w")
            ? "active-timer"
            : ""
        }`}
        style={{
          padding: "8px 16px",
          borderRadius: "4px",
          backgroundColor:
            activeTimer === (playerColor === "w" ? "b" : "w")
              ? "#ffecb3"
              : "#e0e0e0",
        }}
      >
        Computer Time: {formatTime(computerTime)}
      </div>
    </div>
  );
};

export default TimerDisplay;
