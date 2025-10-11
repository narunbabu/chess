
// src/App.js
import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import PlayComputer from "./components/play/PlayComputer";
import PlayMultiplayer from "./components/play/PlayMultiplayer";
import TrainingHub from "./components/TrainingHub";
import TrainingExercise from "./components/TrainingExercise";
import GameHistory from "./components/GameHistory";
import GameReview from "./components/GameReview";
import Login from "./pages/Login";
import Dashboard from "./components/Dashboard";
import AuthCallback from "./components/auth/AuthCallback";
import LandingPage from "./pages/LandingPage";
import LobbyPage from "./pages/LobbyPage";
import Puzzles from "./components/Puzzles";
import Learn from "./components/Learn";
import { AuthProvider } from "./contexts/AuthContext";
import { AppDataProvider } from "./contexts/AppDataContext";
import { FeatureFlagsProvider } from "./contexts/FeatureFlagsContext";
import Layout from "./components/layout/Layout";
import Footer from "./components/layout/Footer";
import RouteGuard from "./components/routing/RouteGuard";
import { requireAuth } from "./utils/guards";

const App = () => {
  useEffect(()=> {
    const mq = window.matchMedia("(orientation:landscape)");
    const toggle = e=> {
       document.documentElement.classList.toggle("landscape", e.matches);
    };
    toggle(mq);
    mq.addEventListener("change", toggle);
    return ()=>mq.removeEventListener("change", toggle);
  },[]);

  return (
    <AuthProvider>
      <AppDataProvider>
        <FeatureFlagsProvider>
          <Router future={{ v7_relativeSplatPath: true }}>
            <Layout>
              <AppContent />
            </Layout>
          </Router>
        </FeatureFlagsProvider>
      </AppDataProvider>
    </AuthProvider>
  );
};

// Component to add full-bleed class for landing page
const AppContent = () => {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';

  return (
    <div className={`app-container ${isLandingPage ? 'full-bleed' : ''} flex flex-col min-h-screen`}>
      <div className="content-wrapper flex-grow">
        <main className="main-content">
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/puzzles" element={<Puzzles />} />
            <Route path="/learn" element={<Learn />} />

            {/* Play computer - No auth required */}
            <Route path="/play" element={<PlayComputer />} />

            {/* Multiplayer game routes - Auth required */}
            <Route
              path="/play/:gameId"
              element={requireAuth(<PlayMultiplayer />, 'multiplayer')}
            />
            <Route
              path="/play/multiplayer/:gameId"
              element={requireAuth(<PlayMultiplayer />, 'multiplayer')}
            />
            {/* Lobby - Auth required */}
            <Route
              path="/lobby"
              element={requireAuth(<LobbyPage />, 'lobby')}
            />
            <Route
              path="/dashboard"
              element={
                <RouteGuard>
                  <Dashboard />
                </RouteGuard>
              }
            />
            <Route
              path="/training"
              element={
                <RouteGuard>
                  <TrainingHub />
                </RouteGuard>
              }
            />
            <Route
              path="/training/:level/:id"
              element={
                <RouteGuard>
                  <TrainingExercise />
                </RouteGuard>
              }
            />
            <Route
              path="/history"
              element={
                <RouteGuard>
                  <GameHistory />
                </RouteGuard>
              }
            />
            <Route
              path="/game-review"
              element={
                <RouteGuard>
                  <GameReview />
                </RouteGuard>
              }
            />
            <Route
              path="/play/review/:id"
              element={
                <RouteGuard>
                  <GameReview />
                </RouteGuard>
              }
            />
          </Routes>
        </main>
      </div>
      <Footer />
    </div>
  );
};

export default App;
