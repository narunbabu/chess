
// src/App.js
import React, { useEffect, lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";

// Critical imports - loaded immediately (providers, layout, utilities)
import { AuthProvider } from "./contexts/AuthContext";
import { AppDataProvider } from "./contexts/AppDataContext";
import { FeatureFlagsProvider } from "./contexts/FeatureFlagsContext";
import { GlobalInvitationProvider } from "./contexts/GlobalInvitationContext";
import { ChampionshipProvider } from "./contexts/ChampionshipContext";
import { ChampionshipInvitationProvider } from "./contexts/ChampionshipInvitationContext";
import { GameNavigationProvider } from "./contexts/GameNavigationContext";
import GlobalInvitationDialog from "./components/invitations/GlobalInvitationDialog";
import { GameNavigationWarningDialogWrapper } from "./components/game/GameNavigationWarningDialog";
import Layout from "./components/layout/Layout";
import Footer from "./components/layout/Footer";
import RouteGuard from "./components/routing/RouteGuard";
import { requireAuth } from "./utils/guards";

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-50 to-white">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-sky-600 mx-auto mb-4"></div>
      <p className="text-gray-600 text-lg">Loading...</p>
    </div>
  </div>
);

// Lazy-loaded page components (loaded on-demand)
const LandingPage = lazy(() => import("./pages/LandingPage"));
const Login = lazy(() => import("./pages/Login"));
const AuthCallback = lazy(() => import("./components/auth/AuthCallback"));
const PlayComputer = lazy(() => import("./components/play/PlayComputer"));
const PlayMultiplayer = lazy(() => import("./components/play/PlayMultiplayer"));
const LobbyPage = lazy(() => import("./pages/LobbyPage"));
const GameHistoryPage = lazy(() => import("./pages/GameHistoryPage"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));
const SharedResultPage = lazy(() => import("./pages/SharedResultPage"));
const Puzzles = lazy(() => import("./components/Puzzles"));
const Learn = lazy(() => import("./components/Learn"));
const Profile = lazy(() => import("./components/Profile"));
const Dashboard = lazy(() => import("./components/Dashboard"));
const TrainingHub = lazy(() => import("./components/TrainingHub"));
const TrainingExercise = lazy(() => import("./components/TrainingExercise"));
const TutorialHub = lazy(() => import("./components/tutorial/TutorialHub"));
const ModuleDetail = lazy(() => import("./components/tutorial/ModuleDetail"));
const LessonPlayer = lazy(() => import("./components/tutorial/LessonPlayer"));
const GameHistory = lazy(() => import("./components/GameHistory"));
const GameReview = lazy(() => import("./components/GameReview"));

// Championship Components (lazy-loaded)
const ChampionshipList = lazy(() => import("./components/championship/ChampionshipList"));
const ChampionshipDetails = lazy(() => import("./components/championship/ChampionshipDetails"));
const TournamentAdminDashboard = lazy(() => import("./components/championship/TournamentAdminDashboard"));
const ChampionshipInvitations = lazy(() => import("./pages/ChampionshipInvitations"));
const ChampionshipMatchesEdit = lazy(() => import("./components/championship/ChampionshipMatchesEdit"));
const ChampionshipVictoryTest = lazy(() => import("./tests/ChampionshipVictoryTest"));
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
              <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
                <GameNavigationProvider>
                  <Layout>
                    <GlobalInvitationProvider>
                    <AppContent />

                    <GlobalInvitationDialog />
                    </GlobalInvitationProvider>

                    {/* Game Navigation Warning Dialog */}
                    <GameNavigationWarningDialogWrapper />
                  </Layout>
                </GameNavigationProvider>
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
          <Suspense fallback={<PageLoader />}>
            <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/puzzles" element={<Puzzles />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/coming-soon" element={<ComingSoon />} />
            <Route path="/share/result/:uniqueId" element={<SharedResultPage />} />

            {/* Play computer - No auth required */}
            <Route path="/play" element={<PlayComputer />} />
            <Route path="/test/championship" element={<ChampionshipVictoryTest />} />

            {/* Game History - Guest users */}
            <Route path="/game-history" element={<GameHistoryPage />} />

            {/* Multiplayer game routes - Auth required */}
            <Route
              path="/play/:gameId"
              element={requireAuth(<PlayMultiplayer />, 'multiplayer')}
            />
            <Route
              path="/play/multiplayer/:gameId"
              element={requireAuth(<PlayMultiplayer />, 'multiplayer')}
            />
            {/* Tutorial System - Auth required */}
            <Route
              path="/tutorial"
              element={requireAuth(<TutorialHub />, 'tutorial')}
            />
            <Route
              path="/tutorial/module/:slug"
              element={requireAuth(<ModuleDetail />, 'tutorial')}
            />
            <Route
              path="/tutorial/lesson/:lessonId"
              element={requireAuth(<LessonPlayer />, 'tutorial')}
            />
            <Route
              path="/tutorial/daily"
              element={requireAuth(<div className="min-h-screen flex items-center justify-center"><div className="text-center"><h1 className="text-4xl font-bold mb-4">🏅 Daily Challenge</h1><p className="text-gray-600">Coming Soon!</p></div></div>, 'tutorial')}
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
          </Suspense>
        </main>
      </div>
      <Footer />
    </div>
  );
};

export default App;
