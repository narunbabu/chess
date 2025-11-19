
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
import Profile from "./components/Profile";
import SharedResultPage from "./pages/SharedResultPage";
import { AuthProvider } from "./contexts/AuthContext";
import { AppDataProvider } from "./contexts/AppDataContext";
import { FeatureFlagsProvider } from "./contexts/FeatureFlagsContext";
import { GlobalInvitationProvider } from "./contexts/GlobalInvitationContext";
import { ChampionshipProvider } from "./contexts/ChampionshipContext";
import { ChampionshipInvitationProvider } from "./contexts/ChampionshipInvitationContext";
import GlobalInvitationDialog from "./components/invitations/GlobalInvitationDialog";
import Layout from "./components/layout/Layout";
import Footer from "./components/layout/Footer";
import RouteGuard from "./components/routing/RouteGuard";
import { requireAuth } from "./utils/guards";

// Championship Components
import ChampionshipList from "./components/championship/ChampionshipList";
import ChampionshipDetails from "./components/championship/ChampionshipDetails";
import TournamentAdminDashboard from "./components/championship/TournamentAdminDashboard";
import ChampionshipInvitations from "./pages/ChampionshipInvitations";
import ChampionshipMatchesEdit from "./components/championship/ChampionshipMatchesEdit";
import ChampionshipVictoryTest from './tests/ChampionshipVictoryTest';
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
          <ChampionshipProvider>
            <ChampionshipInvitationProvider>
              <Router future={{ v7_relativeSplatPath: true }}>
                <Layout>
                  <GlobalInvitationProvider>
                  <AppContent />

                  <GlobalInvitationDialog />
                </GlobalInvitationProvider>
                </Layout>
              </Router>
            </ChampionshipInvitationProvider>
          </ChampionshipProvider>
           
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
            <Route path="/share/result/:uniqueId" element={<SharedResultPage />} />

            {/* Play computer - No auth required */}
            <Route path="/play" element={<PlayComputer />} />
            <Route path="/test/championship" element={<ChampionshipVictoryTest />} />

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
            {/* Profile - Auth required */}
            <Route
              path="/profile"
              element={
                <RouteGuard>
                  <Profile />
                </RouteGuard>
              }
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
            {/* Championship Routes - Auth required */}
            <Route
              path="/championships"
              element={
                <RouteGuard>
                  <ChampionshipList />
                </RouteGuard>
              }
            />
            <Route
              path="/championships/:id"
              element={
                <RouteGuard>
                  <ChampionshipDetails />
                </RouteGuard>
              }
            />
            <Route
              path="/championships/:id/admin"
              element={
                <RouteGuard>
                  <TournamentAdminDashboard />
                </RouteGuard>
              }
            />
            <Route
              path="/championships/:id/matches/edit"
              element={
                <RouteGuard>
                  <ChampionshipMatchesEdit />
                </RouteGuard>
              }
            />
            <Route
              path="/championship-invitations"
              element={
                <RouteGuard>
                  <ChampionshipInvitations />
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
