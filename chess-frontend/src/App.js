
// src/App.js
import React, { useState, useEffect, useCallback } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import PlayComputer from "./components/play/PlayComputer";
import TrainingHub from "./components/TrainingHub";
import TrainingExercise from "./components/TrainingExercise";
import GameHistory from "./components/GameHistory";
import GameReview from "./components/GameReview";
import Login from "./pages/Login";
import Dashboard from "./components/Dashboard";
import AuthCallback from "./components/auth/AuthCallback";
import LandingPage from "./pages/LandingPage";
import { AuthProvider } from "./contexts/AuthContext";  // Import the AuthProvider

// Helper component to manage layout class based on route and orientation
const LayoutManager = ({ children }) => {
  const location = useLocation();
  const [isLandscape, setIsLandscape] = useState(
    window.matchMedia("(orientation: landscape)").matches
  );
  const [isGameRoute, setIsGameRoute] = useState(location.pathname === '/play');

  useEffect(() => {
    setIsGameRoute(location.pathname === '/play');
  }, [location.pathname]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(orientation: landscape)");
    const handleOrientationChange = (event) => {
      setIsLandscape(event.matches);
    };

    mediaQuery.addEventListener('change', handleOrientationChange);
    setIsLandscape(mediaQuery.matches);

    return () => {
      mediaQuery.removeEventListener('change', handleOrientationChange);
    };
  }, []);

  const containerClass = isGameRoute && isLandscape ? 'game-in-landscape' : '';

  return <div className={`app-container ${containerClass}`}>{children}</div>;
};

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const checkTokenValidity = useCallback(() => {
    const token = localStorage.getItem("auth_token");
    setIsLoggedIn(!!token);
  }, []);

  useEffect(() => {
    checkTokenValidity();
  }, [checkTokenValidity]);

  useEffect(()=>{
    const mq = window.matchMedia("(orientation:landscape)");
    const toggle = e=>{
       document.documentElement.classList.toggle("landscape", e.matches);
    };
    toggle(mq);                 // run immediately
    mq.addEventListener("change", toggle);
    return ()=>mq.removeEventListener("change", toggle);
  },[]);

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    setIsLoggedIn(false);
    window.location.href = "/"; // Consider using useNavigate for internal navigation
  };

  return (
    <AuthProvider>
      <Router>
        <LayoutManager>
          <header className="app-header">
            <div className="logo">
              <Link to="/" className="logo-link">
                {/* Logo content or img tag can go here if needed */}
              </Link>
            </div>
            <nav className="auth-nav">
              {isLoggedIn ? (
                <>
                  <Link to="/dashboard" className="nav-link">Dashboard</Link>
                  <button onClick={handleLogout} className="auth-button logout-button">
                    Logout
                  </button>
                </>
              ) : (
                <Link to="/login" className="auth-button login-button">Login</Link>
              )}
            </nav>
          </header>

          <div className="content-wrapper">
            <main className="main-content">
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/play" element={<PlayComputer />} />
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/training" element={<TrainingHub />} />
                <Route path="/training/:level/:id" element={<TrainingExercise />} />
                <Route path="/history" element={<GameHistory />} />
                <Route path="/game-review" element={<GameReview />} />
              </Routes>
            </main>
          </div>
        </LayoutManager>
      </Router>
    </AuthProvider>
  );
};

export default App;
