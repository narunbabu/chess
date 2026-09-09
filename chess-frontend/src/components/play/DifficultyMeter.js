// src/components/play/DifficultyMeter.js
// Replaced canvas gauge with labeled difficulty buttons for better UX (P-R2)
import React from "react";

const LEVELS = [
  { label: "Beginner",  emoji: "🌱", range: [1, 3],   movetime: 500,  color: "#4ade80" },
  { label: "Easy",      emoji: "😊", range: [4, 6],   movetime: 800,  color: "#81b64c" },
  { label: "Medium",    emoji: "🎯", range: [7, 10],  movetime: 1200, color: "#e8a93e" },
  { label: "Hard",      emoji: "💪", range: [11, 13], movetime: 1600, color: "#f97316" },
  { label: "Expert",    emoji: "🔥", range: [14, 16], movetime: 2000, color: "#e74c3c" },
];

function getActiveLevel(value) {
  return LEVELS.findIndex(l => value >= l.range[0] && value <= l.range[1]);
}

export default function DifficultyMeter({
  min = 1,
  max = 16,
  onChange,
  value: currentValue = 1,
  disabled = false,
}) {
  const activeIdx = getActiveLevel(currentValue);

  const handleSelect = (levelIdx) => {
    if (disabled) return;
    // Pick the midpoint of the depth range for that level
    const level = LEVELS[levelIdx];
    const midDepth = Math.round((level.range[0] + level.range[1]) / 2);
    onChange && onChange(midDepth);
  };

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "6px",
        }}
      >
        {LEVELS.map((level, idx) => {
          const isActive = idx === activeIdx;
          return (
            <button
              key={level.label}
              onClick={() => handleSelect(idx)}
              disabled={disabled}
              aria-pressed={isActive}
              title={`Depth ${level.range[0]}–${level.range[1]}, ~${level.movetime}ms think time`}
              style={{
                padding: "8px 4px",
                borderRadius: "8px",
                border: isActive ? `2px solid ${level.color}` : "2px solid #3d3a37",
                background: isActive ? `${level.color}22` : "transparent",
                color: "#f5f2ec",
                fontWeight: isActive ? "700" : "500",
                fontSize: "0.875rem",
                minHeight: "48px",
                cursor: disabled ? "not-allowed" : "pointer",
                transition: "all 0.15s ease",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2px",
                opacity: disabled ? 0.5 : 1,
              }}
            >
              <span style={{ fontSize: "1.1rem" }}>{level.emoji}</span>
              <span>{level.label}</span>
            </button>
          );
        })}
      </div>
      <div style={{ textAlign: "center", marginTop: "8px", fontSize: "0.875rem", color: "#c3beb6" }}>
        {activeIdx >= 0 ? `${LEVELS[activeIdx].label} computer opponent` : 'Choose a computer level'}
      </div>
    </div>
  );
}
