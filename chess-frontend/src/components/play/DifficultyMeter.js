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
  width,
  height,
  value: initialValue = min,
  disabled = false,
}) {
  const canvasRef = useRef(null);
  const [value, setValue] = useState(initialValue);
  const [angle, setAngle] = useState(valueToAngle(initialValue));

  // Responsive dimensions - use window width if width not provided
  const [dimensions, setDimensions] = useState({
    width: width || 150,
    height: height || 100,
    radius: radius
  });

  // Update dimensions on window resize for mobile responsiveness
  useEffect(() => {
    const updateDimensions = () => {
      const isMobile = window.innerWidth <= 768; // Mobile breakpoint
      const isLandscape = window.innerWidth > window.innerHeight;
      let containerWidth, calculatedRadius, calculatedHeight;

      if (isMobile && isLandscape) {
        // Mobile landscape - more compact sizing
        containerWidth = Math.min(window.innerWidth - 40, 120); // Smaller max width for landscape
        calculatedRadius = Math.min(containerWidth / 2 - 15, 60); // Smaller radius for landscape
        calculatedHeight = calculatedRadius + 30; // Reduced height for landscape
      } else if (isMobile) {
        // Mobile portrait
        containerWidth = Math.min(window.innerWidth - 40, 150);
        calculatedRadius = Math.min(containerWidth / 2 - 20, 80);
        calculatedHeight = calculatedRadius + 40;
      } else {
        // Desktop
        containerWidth = 150;
        calculatedRadius = Math.min(containerWidth / 2 - 20, 100);
        calculatedHeight = calculatedRadius + 50;
      }

      setDimensions({
        width: width || containerWidth,
        height: height || calculatedHeight,
        radius: width ? radius : calculatedRadius
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [width, height, radius]);

  const center = { x: dimensions.width / 2, y: dimensions.height }; // Center at the bottom for a half-circle arc

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

    // Set canvas actual size to match display size for proper scaling
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    // Only resize if different to avoid infinite loops
    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      ctx.scale(dpr, dpr);
    }

    // Clear the canvas using display dimensions
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // Calculate drawing center and radius based on display dimensions
    const drawCenter = {
      x: displayWidth / 2,
      y: displayHeight - 10 // Slight padding from bottom
    };
    const drawRadius = Math.min(displayWidth / 2 - 20, dimensions.radius);

    // Background arc in a lighter shade.
    ctx.beginPath();
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = "#e0e0e0";
    ctx.arc(
      drawCenter.x,
      drawCenter.y,
      drawRadius,
      degToRad(startAngle),
      degToRad(endAngle),
      false
    );
    ctx.stroke();

    // Active arc with a gradient for visual appeal.
    const gradient = ctx.createLinearGradient(
      drawCenter.x - drawRadius,
      drawCenter.y,
      drawCenter.x + drawRadius,
      drawCenter.y
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
      drawCenter.x,
      drawCenter.y,
      drawRadius,
      degToRad(startAngle),
      degToRad(angle),
      false
    );
    ctx.stroke();

    // Draw the knob at the end of the active arc with a subtle shadow.
    const knobX = drawCenter.x + drawRadius * Math.cos(degToRad(angle));
    const knobY = drawCenter.y + drawRadius * Math.sin(degToRad(angle));
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
    // Responsive font size based on display dimensions
    const fontSize = Math.max(12, Math.min(18, drawRadius / 4));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Hardness: " + value, drawCenter.x, drawCenter.y - drawRadius / 3); // Adjust vertical position proportionally
  };

  const updateFromPosition = (clientX, clientY) => {
    if (disabled) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Use display dimensions for coordinate calculation
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    const drawCenter = {
      x: displayWidth / 2,
      y: displayHeight - 10
    };
    const drawRadius = Math.min(displayWidth / 2 - 20, dimensions.radius);

    const dx = x - drawCenter.x;
    const dy = y - drawCenter.y;

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
  }, [angle, value, disabled, dimensions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={{
        cursor: disabled ? "not-allowed" : "pointer",
        borderRadius: "8px",
        background: "transparent",
        touchAction: "none",
        transition: "transform 0.1s ease-in-out",
        width: `${dimensions.width}px`, // Use exact calculated width
        height: `${dimensions.height}px`, // Use exact calculated height
        maxWidth: "100%", // Ensure it fits container
        display: "block", // Prevent inline spacing issues
      }}
    />
  );
}