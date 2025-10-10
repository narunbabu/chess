// chess-trainer/src/components/Countdown.js
import React, { useState, useEffect } from "react";

const Countdown = ({ startValue = 5, onCountdownFinish }) => {
  const [counter, setCounter] = useState(startValue);

  useEffect(() => {
    if (counter < 0) {
      onCountdownFinish();
      return;
    }
    const timer = setTimeout(() => {
      setCounter(counter - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [counter, onCountdownFinish]);

  return (
    <div className="countdown-overlay" style={overlayStyle}>
      <div style={countStyle}>
        {counter > 0 ? counter : counter === 0 ? "Start" : null}
      </div>
    </div>
  );
};

const overlayStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  fontSize: "3rem",
  background: "rgba(0,0,0,0.6)",
  color: "white",
  padding: "20px",
  borderRadius: "8px",
};

const countStyle = {
  textAlign: "center",
};

export default Countdown;
