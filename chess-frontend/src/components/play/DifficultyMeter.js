// src/components/play/DifficultyMeter.js
import React, { useRef, useEffect, useState } from "react";

export default function DifficultyMeter({
  radius = 100,
  strokeWidth = 15, // Increased default stroke width for better visibility
  min = 1,
  max = 16,
  // Draw the arc on the top half: from -180 (far left) to 0 (far right)
  startAngle = -180,
  endAngle = 0,
  onChange,
  width = 250,
  height = 150, // Adjusted height to better fit the half-circle design
  value: initialValue = min,
  disabled = false,
}) {
  const canvasRef = useRef(null);
  const [value, setValue] = useState(initialValue);
  const [angle, setAngle] = useState(valueToAngle(initialValue));
  const center = { x: width / 2, y: height }; // Center at the bottom for a half-circle arc

  // --- Helper Functions ---
  const degToRad = (deg) => (deg * Math.PI) / 180;
  const radToDeg = (rad) => (rad * 180) / Math.PI;

  // Convert value → angle (linear interpolation)
  function valueToAngle(val) {
    const fraction = (val - min) / (max - min);
    return startAngle + fraction * (endAngle - startAngle);
  }

  // Convert angle → value (linear interpolation)
  function angleToValue(angleDeg) {
    const fraction = (angleDeg - startAngle) / (endAngle - startAngle);
    return Math.round(min + fraction * (max - min));
  }

  // Define a ramp of richer colors based on value.
  function getArcColor(val) {
    if (val <= 4) return "#2ecc71";   // Vibrant Green
    else if (val <= 8) return "#f1c40f"; // Bright Yellow
    else if (val <= 12) return "#e67e22"; // Vivid Orange
    else return "#e74c3c";            // Strong Red
  }

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);

    // Background arc in a lighter shade.
    ctx.beginPath();
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = "#e0e0e0";
    ctx.arc(
      center.x,
      center.y,
      radius,
      degToRad(startAngle),
      degToRad(endAngle),
      false
    );
    ctx.stroke();

    // Active arc with a gradient for visual appeal.
    const gradient = ctx.createLinearGradient(
      center.x - radius,
      center.y,
      center.x + radius,
      center.y
    );
    const startColor = getArcColor(min);
    const endColor = getArcColor(max);

    // Create a more nuanced gradient based on the value
    const currentColor = getArcColor(value);
    const fraction = (value - min) / (max - min);

    gradient.addColorStop(0, startColor);
    gradient.addColorStop(fraction, currentColor);
    gradient.addColorStop(1, endColor);

    ctx.beginPath();
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = gradient;
    ctx.arc(
      center.x,
      center.y,
      radius,
      degToRad(startAngle),
      degToRad(angle),
      false
    );
    ctx.stroke();

    // Draw the knob at the end of the active arc with a subtle shadow.
    const knobX = center.x + radius * Math.cos(degToRad(angle));
    const knobY = center.y + radius * Math.sin(degToRad(angle));
    ctx.beginPath();
    ctx.fillStyle = currentColor;
    ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.arc(knobX, knobY, strokeWidth / 2 + 2, 0, 2 * Math.PI); // Slightly larger knob
    ctx.fill();
    ctx.shadowColor = null;
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Write the current value in the center, slightly above the bottom.
    ctx.fillStyle = "#fff";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Hardness: " + value, center.x, center.y - 30); // Adjust vertical position
  };

  const updateFromPosition = (clientX, clientY) => {
    if (disabled) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const dx = x - center.x;
    const dy = y - center.y;

    let angleDeg = radToDeg(Math.atan2(dy, dx));

    if (angleDeg > 180) {
      angleDeg = angleDeg - 360;
    }

    if (angleDeg < startAngle) angleDeg = startAngle;
    if (angleDeg > endAngle) angleDeg = endAngle;

    setAngle(angleDeg);
    const newValue = angleToValue(angleDeg);
    setValue(newValue);
    if (onChange) onChange(newValue);
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    updateFromPosition(e.clientX, e.clientY);

    const moveHandler = (moveEvt) => {
      updateFromPosition(moveEvt.clientX, moveEvt.clientY);
    };

    const upHandler = () => {
      document.removeEventListener("mousemove", moveHandler);
      document.removeEventListener("mouseup", upHandler);
    };

    document.addEventListener("mousemove", moveHandler);
    document.addEventListener("mouseup", upHandler);
  };

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    updateFromPosition(touch.clientX, touch.clientY);

    const moveHandler = (moveEvt) => {
      const t = moveEvt.touches[0];
      updateFromPosition(t.clientX, t.clientY);
    };

    const endHandler = () => {
      document.removeEventListener("touchmove", moveHandler);
      document.removeEventListener("touchend", endHandler);
    };

    document.addEventListener("touchmove", moveHandler, { passive: false });
    document.addEventListener("touchend", endHandler);
  };

  useEffect(() => {
    draw();
  }, [angle, value, disabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={{
        cursor: disabled ? "not-allowed" : "pointer",
        borderRadius: "8px",
        background: "transparent", // Set background to transparent
        touchAction: "none",
        transition: "transform 0.1s ease-in-out", // Subtle scale animation on interaction
      }}
    />
  );
}