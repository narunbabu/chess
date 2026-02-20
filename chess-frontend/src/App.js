
// src/App.js
import React, { useEffect, lazy } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { createLazyComponent } from "./utils/lazyLoad";

// Critical imports - loaded immediately (providers, layout, utilities)
import { AuthProvider } from "./contexts/AuthContext";
import { AppDataProvider } from "./contexts/AppDataContext";
import { FeatureFlagsProvider } from "./contexts/FeatureFlagsContext";
import { GlobalInvitationProvider } from "./contexts/GlobalInvitationContext";
import { ChampionshipProvider } from "./contexts/ChampionshipContext";
import { ChampionshipInvitationProvider } from "./contexts/ChampionshipInvitationContext";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import { GameNavigationProvider } from "./contexts/GameNavigationContext";
import GlobalInvitationDialog from "./components/invitations/GlobalInvitationDialog";
import { GameNavigationWarningDialogWrapper } from "./components/game/GameNavigationWarningDialog";
import Layout from "./components/layout/Layout";
import Footer from "./components/layout/Footer";
import RouteGuard from "./components/routing/RouteGuard";
import { requireAuth } from "./utils/guards";
import GameErrorBoundary from "./components/play/GameErrorBoundary";
import LandingPage from "./pages/LandingPage";

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#262421]">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#81b64c] mx-auto mb-4"></div>
      <p className="text-[#bababa] text-lg">Loading...</p>
    </div>
  </div>
);

// Lazy-loaded page components with error handling
const Login = createLazyComponent(() => import("./pages/Login"), { componentName: "Login" });
const AuthCallback = createLazyComponent(() => import("./components/auth/AuthCallback"), { componentName: "AuthCallback" });
const PlayComputer = createLazyComponent(() => import("./components/play/PlayComputer"), { componentName: "PlayComputer" });
const PlayMultiplayer = createLazyComponent(() => import("./components/play/PlayMultiplayer"), { componentName: "PlayMultiplayer" });
const LobbyPage = createLazyComponent(() => import("./pages/LobbyPage"), { componentName: "LobbyPage" });
const GameHistoryPage = createLazyComponent(() => import("./pages/GameHistoryPage"), { componentName: "GameHistoryPage" });
const ComingSoon = createLazyComponent(() => import("./pages/ComingSoon"), { componentName: "ComingSoon" });
const SharedResultPage = createLazyComponent(() => import("./pages/SharedResultPage"), { componentName: "SharedResultPage" });
const Puzzles = createLazyComponent(() => import("./components/Puzzles"), { componentName: "Puzzles" });
const Learn = createLazyComponent(() => import("./components/Learn"), { componentName: "Learn" });
const Profile = createLazyComponent(() => import("./components/Profile"), { componentName: "Profile" });
const Dashboard = createLazyComponent(() => import("./components/Dashboard"), { componentName: "Dashboard" });
const TrainingHub = createLazyComponent(() => import("./components/TrainingHub"), { componentName: "TrainingHub" });
const TrainingExercise = createLazyComponent(() => import("./components/TrainingExercise"), { componentName: "TrainingExercise" });
const TutorialHub = createLazyComponent(() => import("./components/tutorial/TutorialHub"), { componentName: "TutorialHub" });
const ModuleDetail = createLazyComponent(() => import("./components/tutorial/ModuleDetail"), { componentName: "ModuleDetail" });
const LessonPlayer = createLazyComponent(() => import("./components/tutorial/LessonPlayer"), { componentName: "LessonPlayer" });
const GameHistory = createLazyComponent(() => import("./components/GameHistory"), { componentName: "GameHistory" });
const GameReview = createLazyComponent(() => import("./components/GameReview"), { componentName: "GameReview" });

// Championship Components (lazy-loaded with error handling)
const ChampionshipList = createLazyComponent(() => import("./components/championship/ChampionshipList"), { componentName: "ChampionshipList" });
const ChampionshipDetails = createLazyComponent(() => import("./components/championship/ChampionshipDetails"), { componentName: "ChampionshipDetails" });
const TournamentAdminDashboard = createLazyComponent(() => import("./components/championship/TournamentAdminDashboard"), { componentName: "TournamentAdminDashboard" });
const ChampionshipInvitations = createLazyComponent(() => import("./pages/ChampionshipInvitations"), { componentName: "ChampionshipInvitations" });
const ChampionshipMatchesEdit = createLazyComponent(() => import("./components/championship/ChampionshipMatchesEdit"), { componentName: "ChampionshipMatchesEdit" });
const ChampionshipVictoryTest = createLazyComponent(() => import("./tests/ChampionshipVictoryTest"), { componentName: "ChampionshipVictoryTest" });
const PricingPage = createLazyComponent(() => import("./pages/PricingPage"), { componentName: "PricingPage" });
const SubscriptionManagement = createLazyComponent(() => import("./components/subscription/SubscriptionManagement"), { componentName: "SubscriptionManagement" });
const ForgotPasswordPage = createLazyComponent(() => import("./pages/ForgotPasswordPage"), { componentName: "ForgotPasswordPage" });
const ResetPasswordPage = createLazyComponent(() => import("./pages/ResetPasswordPage"), { componentName: "ResetPasswordPage" });
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
        <SubscriptionProvider>
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
        </SubscriptionProvider>
      </AppDataProvider>
    </AuthProvider>
  );
};

// Component to add full-bleed class for landing/login pages
const AppContent = () => {
  const location = useLocation();
  const isFullBleed = ['/', '/login', '/forgot-password', '/reset-password'].includes(location.pathname);

  return (
    <div className={`app-container ${isFullBleed ? 'full-bleed' : ''} flex flex-col min-h-screen`}>
      <div className="content-wrapper flex-grow">
        <main className="main-content">
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/puzzles" element={<Puzzles />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/coming-soon" element={<ComingSoon />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/share/result/:uniqueId" element={<SharedResultPage />} />

            {/* Play computer - No auth required */}
            <Route path="/play" element={<GameErrorBoundary><PlayComputer /></GameErrorBoundary>} />
            <Route path="/test/championship" element={<ChampionshipVictoryTest />} />

            {/* Game History - Guest users */}
            <Route path="/game-history" element={<GameHistoryPage />} />

            {/* Multiplayer game routes - Auth required */}
            <Route
              path="/play/:gameId"
              element={requireAuth(<GameErrorBoundary><PlayMultiplayer /></GameErrorBoundary>, 'multiplayer')}
            />
            <Route
              path="/play/multiplayer/:gameId"
              element={requireAuth(<GameErrorBoundary><PlayMultiplayer /></GameErrorBoundary>, 'multiplayer')}
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
            {/* Subscription Management - Auth required */}
            <Route
              path="/account/subscription"
              element={
                <RouteGuard>
                  <SubscriptionManagement />
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
