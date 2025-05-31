
import React from "react";

const ScoreDisplay = ({ playerScore, lastMoveEvaluation }) => {
  return (
    <div
      className="score-display"
      style={{
        marginBottom: "10px",
        padding: "10px",
        backgroundColor: "#f5f5f5",
        borderRadius: "4px",
        width: "100%",
        maxWidth: "600px",
      }}
    >
      <div style={{ fontWeight: "bold" }}>
        Your Score:{" "}
        {typeof playerScore === "number" ? playerScore.toFixed(1) : "0.0"}
      </div>
      {lastMoveEvaluation && (
        <div style={{ fontSize: "0.9em", marginTop: "5px" }}>
          Last Move: {lastMoveEvaluation.moveClassification} (+
          {typeof lastMoveEvaluation.total === "number"
            ? lastMoveEvaluation.total.toFixed(1)
            : "0.0"}{" "}
          points)
        </div>
      )}
    </div>
  );
};

export default ScoreDisplay;
