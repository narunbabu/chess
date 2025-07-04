/*
 * File: src/components/play/TimerButton.js
 * Modifications:
 * - Added `disabled` prop to the button element.
 */
import React from "react";

const TimerButton = ({
  timerButtonColor,
  timerButtonText,
  moveCompleted,
  activeTimer,
  playerColor,
  onClick,
  disabled, // Added disabled prop
}) => {
  return (
    <div style={{ marginTop: "20px", textAlign: "center" }}> {/* Centered button */}
      <button
        onClick={onClick}
        disabled={disabled} // Use the disabled prop
        style={{
          backgroundColor: timerButtonColor,
          width: "120px",
          height: "120px",
          borderRadius: "60px",
          fontSize: "16px",
          fontWeight: "bold",
          cursor: disabled ? "default" : "pointer", // Adjust cursor based on disabled state
          opacity: disabled ? 0.7 : 1, // Adjust opacity based on disabled state
          transition: "background-color 0.3s, opacity 0.3s",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          border: "none",
          boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
          color: "white", // Ensure text is visible
          textAlign: "center", // Center text inside button
        }}
      >
        {timerButtonText}
      </button>
    </div>
  );
};

export default TimerButton;
