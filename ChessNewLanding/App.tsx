import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import PlayComputer from './components/PlayComputer';
import Puzzles from './components/Puzzles';
import Learn from './components/Learn';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/play-computer" element={<PlayComputer />} />
        <Route path="/puzzles" element={<Puzzles />} />
        <Route path="/learn" element={<Learn />} />
        {/* Redirect other paths from the original example to the login page */}
        <Route path="/play" element={<Navigate to="/" />} />
        <Route path="/history" element={<Navigate to="/" />} />
        <Route path="/training" element={<Navigate to="/" />} />
        <Route path="/training/beginner/1" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
};

export default App;