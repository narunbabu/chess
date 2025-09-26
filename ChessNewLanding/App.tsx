
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        {/* Redirect other paths from the original example to the login page */}
        <Route path="/play" element={<Navigate to="/login" />} />
        <Route path="/history" element={<Navigate to="/login" />} />
        <Route path="/training" element={<Navigate to="/login" />} />
        <Route path="/training/beginner/1" element={<Navigate to="/login" />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
