import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import api from '../../services/api';
import logger from '../../utils/logger';
import { DEFAULTS, TIMING, getTierColor, getTierIcon, getTierName } from '../../constants/tutorialConstants';
import ErrorBoundary from './ErrorBoundary';
import '../../styles/UnifiedCards.css';

const TutorialHub = () => {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const navigate = useNavigate();
  const location = useLocation();
  const [modules, setModules] = useState([]);
  const [stats, setStats] = useState(null);
  const [nextLesson, setNextLesson] = useState(null);
  const [dailyChallenge, setDailyChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState('beginner');
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    // Check if we just completed a lesson
    if (location.state?.completed) {
      setShowCompletionMessage(true);
      // Clear the state to prevent showing the message again on refresh
      window.history.replaceState({}, document.title);

      // Hide the message after configured duration
      setTimeout(() => {
        setShowCompletionMessage(false);
      }, TIMING.COMPLETION_MESSAGE_DURATION);

      // Enhanced refresh with verified progress if available
      if (location.state?.verifiedProgress) {
        logger.debug('Tutorial:verified-progress', location.state.verifiedProgress);
        loadTutorialData(location.state.verifiedProgress);
      } else {
        logger.debug('Tutorial:refresh', 'Refreshing data after lesson completion');
        loadTutorialData();
      }
    } else {
      // Normal load
      loadTutorialData();
    }
  }, [location]);

  const loadTutorialData = async (verifiedProgress = null) => {
    try {
      setLoading(true);
      setAuthError(false); // Reset auth error on new attempt

      // Load modules with progress - add cache-busting parameter to ensure fresh data
      const timestamp = Date.now();
      const modulesResponse = await api.get(`/tutorial/modules?_t=${timestamp}`);
      const modulesData = modulesResponse.data.data;

      logger.debug('Tutorial:modules-loaded', modulesData);
      if (modulesData && modulesData.length > 0) {
        modulesData.forEach((module, index) => {
          logger.debug(`Tutorial:module-${index + 1}`, {
            name: module.name,
            total_lessons: module.user_progress?.total_lessons,
            completed_lessons: module.user_progress?.completed_lessons,
            percentage: module.user_progress?.percentage,
            is_completed: module.user_progress?.is_completed,
            lessons: module.lessons?.map(l => ({
              id: l.id,
              title: l.title,
              status: l.user_progress?.status,
              is_completed: l.user_progress?.status === 'completed'
            })) || module.activeLessons?.map(l => ({
              id: l.id,
              title: l.title,
              status: l.user_progress?.status,
              is_completed: l.user_progress?.status === 'completed'
            }))
          });
        });
      }

      setModules(modulesData);

      // Load user progress and stats (or use verified progress)
      let progressData;
      if (verifiedProgress) {
        // When coming from lesson completion, verifiedProgress IS the stats object
        progressData = { stats: verifiedProgress };
      } else {
        const progressResponse = await api.get('/tutorial/progress');
        progressData = progressResponse.data.data;
      }

      // Standardized API response structure
      const userStats = progressData.stats || {
        completed_lessons: 0,
        total_lessons: DEFAULTS.TOTAL_LESSONS,
        completion_percentage: DEFAULTS.COMPLETION_PERCENTAGE,
        average_score: DEFAULTS.AVERAGE_SCORE,
        current_streak: DEFAULTS.CURRENT_STREAK,
        skill_tier: DEFAULTS.SKILL_TIER,
        level: DEFAULTS.LEVEL,
        xp: DEFAULTS.XP,
        formatted_time_spent: DEFAULTS.FORMATTED_TIME_SPENT
      };

      const nextLesson = progressData.next_lesson || null;

      logger.debug('Tutorial:user-stats', userStats);
      setStats(userStats);
      setNextLesson(nextLesson);

      // Load daily challenge
      const challengeResponse = await api.get('/tutorial/daily-challenge');
      setDailyChallenge(challengeResponse.data.data);

    } catch (error) {
      logger.error('Tutorial:load-error', error);

      // Check if it's an authentication error
      if (
        error.response?.status === 401 ||
        error.message?.includes('Network Error') ||
        error.message?.includes('ERR_CONNECTION_REFUSED') ||
        (error.code === 'ERR_NETWORK' && window.location.pathname.includes('/tutorial'))
      ) {
        setAuthError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleModuleClick = (module) => {
    // Navigate to the module detail page to show all lessons
    navigate(`/tutorial/module/${module.slug}`);
  };

  const filteredModules = modules.filter(module => module.skill_tier === selectedTier);

  const XPProgressBar = ({ xp, level }) => {
    const xpForNextLevel = Math.floor(100 * Math.pow(1.5, level));
    const currentLevelXp = level === 1 ? 0 : Math.floor(100 * Math.pow(1.5, level - 2));
    const xpNeeded = xpForNextLevel - currentLevelXp;
    const xpEarned = xp - currentLevelXp;
    const progress = Math.min(100, (xpEarned / xpNeeded) * 100);

    return (
      <div className="w-full">
        <div className="flex justify-between text-sm mb-1 font-semibold text-[#bababa]">
          <span>🎖️ Level {level}</span>
          <span>⭐ {xp} XP</span>
        </div>
        <div className="w-full bg-[#3d3a37] rounded-full h-2.5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[#4e7837] via-[#e8a93e] to-[#e8a93e] opacity-30"></div>
          <div
            className="h-2.5 rounded-full transition-all duration-500 relative z-10"
            style={{
              width: `${progress}%`,
              background: 'var(--tutorial-xp-gradient)',
              boxShadow: '0 0 10px rgba(234, 179, 8, 0.6)'
            }}
          />
        </div>
      </div>
    );
  };

  const CircularProgress = ({ percentage, size = 80, strokeWidth = 6 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className="relative inline-flex items-center justify-center">
        <svg
          className="transform -rotate-90"
          width={size}
          height={size}
        >
          <circle
            className="text-[#3d3a37]"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <circle
            className="transition-all duration-300"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold">{Math.round(percentage)}%</span>
        </div>
      </div>
    );
  };

  const tierEmoji = { silver: '🥈', gold: '🥇' };
  const tierLabel = { free: 'Free', silver: 'Silver', gold: 'Gold' };

  const ModuleCard = ({ module, prerequisiteModule }) => {
    const isTierLocked = module.is_tier_locked;
    const isPrereqLocked = !module.is_unlocked;
    const isLocked = isTierLocked || isPrereqLocked;
    const progress = module.user_progress;

    return (
      <div
        key={module.id}
        className={`tutorial-module-card bg-[#312e2b] rounded-2xl shadow-lg border-2 border-[#3d3a37] hover:border-[#81b64c] hover:shadow-2xl transition-all p-6 relative ${isLocked ? 'opacity-75' : ''}`}
      >
        {/* Tier lock overlay — takes priority over prerequisite lock */}
        {isTierLocked && (
          <div className="absolute inset-0 bg-gray-900 bg-opacity-80 rounded-2xl flex items-center justify-center z-10">
            <div className="text-white text-center px-6">
              <div className="text-5xl mb-3">{tierEmoji[module.required_tier] || '👑'}</div>
              <div className="text-lg font-bold mb-2">
                {tierLabel[module.required_tier] || 'Premium'} Content
              </div>
              <div className="text-sm text-[#bababa] mb-4">
                Upgrade to {tierLabel[module.required_tier] || 'Premium'} to access this module
              </div>
              <Link
                to="/pricing"
                className="inline-block px-6 py-3 rounded-xl font-bold text-white text-sm transition-all hover:scale-105"
                style={{
                  background: module.required_tier === 'gold'
                    ? 'linear-gradient(135deg, #e8a93e, #f4c66a)'
                    : 'linear-gradient(135deg, #9b9b9b, #d1d1d1)',
                  boxShadow: module.required_tier === 'gold'
                    ? '0 4px 15px rgba(232,169,62,0.5)'
                    : '0 4px 15px rgba(155,155,155,0.4)',
                }}
              >
                Upgrade →
              </Link>
            </div>
          </div>
        )}

        {/* Prerequisite lock overlay — only if NOT tier-locked */}
        {!isTierLocked && isPrereqLocked && (
          <div className="absolute inset-0 bg-gray-900 bg-opacity-70 rounded-2xl flex items-center justify-center z-10">
            <div className="text-white text-center px-4">
              <div className="text-4xl mb-3">🔒</div>
              {prerequisiteModule ? (
                <div className="text-base font-bold">
                  Complete <span style={{ color: '#e8a93e' }}>"{prerequisiteModule.name}"</span> to unlock
                </div>
              ) : (
                <div className="text-base font-bold">Complete previous lessons to unlock</div>
              )}
            </div>
          </div>
        )}

        {/* Module header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-16 h-16 ${getTierColor(module.skill_tier)} rounded-xl flex items-center justify-center text-white text-2xl shadow-lg transform hover:scale-110 transition-transform`}>
              {module.icon || getTierIcon(module.skill_tier)}
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-white">{module.name}</h3>
              <span className={`inline-block px-3 py-1.5 rounded-lg text-xs font-bold text-white ${getTierColor(module.skill_tier)} shadow-md mt-1`}>
                {getTierName(module.skill_tier)}
              </span>
            </div>
          </div>
          <div className="text-right">
            <CircularProgress percentage={progress.percentage} size={70} />
          </div>
        </div>

        {/* Module info */}
        <p className="text-[#bababa] mb-5 text-base font-semibold">{module.description}</p>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          <div className="text-center p-3 rounded-xl bg-[#3d3a37] border-2 border-[#4a4744] shadow-sm hover:shadow-md transition-shadow">
            <div className="text-2xl font-extrabold text-[#81b64c]">
              {progress.completed_lessons}
            </div>
            <div className="text-xs font-bold text-[#bababa] mt-1">✓ Done</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-[#3d3a37] border-2 border-[#4a4744] shadow-sm hover:shadow-md transition-shadow">
            <div className="text-2xl font-extrabold text-[#bababa]">
              {progress.total_lessons}
            </div>
            <div className="text-xs font-bold text-[#bababa] mt-1">📚 Total</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-[#3d3a37] border-2 border-[#4a4744] shadow-sm hover:shadow-md transition-shadow">
            <div className="text-xl font-extrabold text-[#e8a93e]">
              {progress.earned_xp || 0}/{module.total_xp}
            </div>
            <div className="text-xs font-bold text-[#bababa] mt-1">⭐ XP</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-[#3d3a37] border-2 border-[#4a4744] shadow-sm hover:shadow-md transition-shadow">
            <div className="text-2xl font-extrabold text-[#81b64c]">
              {progress.average_score ? `${Math.round(progress.average_score)}%` : '-'}
            </div>
            <div className="text-xs font-bold text-[#bababa] mt-1">📊 Score</div>
          </div>
        </div>

        {/* Duration */}
        <div className="flex items-center text-base text-[#bababa] font-bold mb-5 bg-[#262421] p-2 rounded-lg">
          <span className="mr-2 text-xl">⏱️</span>
          <span>{module.formatted_duration}</span>
        </div>

        {/* Action button */}
        {isLocked ? (
          <button
            className="w-full py-4 px-4 rounded-xl font-bold transition-colors text-center bg-[#3d3a37] text-[#5c5a57] cursor-not-allowed border-2 border-[#4a4744] text-lg"
            disabled
          >
            🔒 Locked
          </button>
        ) : (
          <button
            onClick={() => handleModuleClick(module)}
            className="w-full py-4 px-4 rounded-xl font-bold transition-all text-center text-white hover:scale-105 hover:shadow-2xl text-lg border-2"
            style={{
              background: progress.is_completed ? 'linear-gradient(135deg, #81b64c, #a3d160)' : 'linear-gradient(135deg, #81b64c, #769656)',
              borderColor: progress.is_completed ? '#81b64c' : '#769656',
              boxShadow: progress.is_completed ? '0 6px 20px rgba(129, 182, 76, 0.4)' : '0 6px 20px rgba(118, 150, 86, 0.4)'
            }}
          >
            {progress.is_completed ? '✅ Review Lessons' : progress.completed_lessons > 0 ? '🚀 Continue Learning' : '📖 View Lessons'}
          </button>
        )}
      </div>
    );
  };

  const QuickStatsCard = () => (
    <div className="tutorial-stats-card bg-[#312e2b] rounded-2xl shadow-lg border-2 border-[#3d3a37] p-6">
      <h3 className="text-2xl font-extrabold mb-5 text-white">📊 Your Progress</h3>

      {/* XP and Level */}
      <div className="mb-6 p-4 bg-[#262421] rounded-xl border-2 border-[#3d3a37] shadow-sm">
        <XPProgressBar xp={stats?.earned_xp || stats?.xp || 0} level={stats?.level || 1} />
        {stats?.earned_xp !== stats?.xp && (
          <div className="mt-2 text-xs text-[#8b8987] text-center">
            <span className="font-semibold">Total XP (with bonuses): {stats?.xp || 0}</span>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="text-center p-3 rounded-xl bg-[#3d3a37] border-2 border-[#4a4744] hover:shadow-lg hover:scale-105 transition-all">
          <div className="text-3xl font-extrabold text-[#81b64c]">
            {stats?.completed_lessons || 0}
          </div>
          <div className="text-xs font-bold text-[#bababa] mt-1">✅ Lessons</div>
        </div>
        <div className="text-center p-3 rounded-xl bg-[#3d3a37] border-2 border-[#4a4744] hover:shadow-lg hover:scale-105 transition-all">
          <div className="text-3xl font-extrabold text-[#e8a93e]">
            {stats?.achievements_count || 0}
          </div>
          <div className="text-xs font-bold text-[#bababa] mt-1">🏆 Achievements</div>
        </div>
        <div className="text-center p-3 rounded-xl bg-[#3d3a37] border-2 border-[#4a4744] hover:shadow-lg hover:scale-105 transition-all">
          <div className="text-3xl font-extrabold text-[#e8a93e]">
            {stats?.current_streak || 0}
          </div>
          <div className="text-xs font-bold text-[#bababa] mt-1">🔥 Day Streak</div>
        </div>
        <div className="text-center p-3 rounded-xl bg-[#3d3a37] border-2 border-[#4a4744] hover:shadow-lg hover:scale-105 transition-all">
          <div className="text-3xl font-extrabold text-[#81b64c]">
            {stats?.completion_percentage || 0}%
          </div>
          <div className="text-xs font-bold text-[#bababa] mt-1">📊 Progress</div>
        </div>
      </div>

      {/* Continue Learning */}
      {nextLesson && (
        <Link
          to={`/tutorial/lesson/${nextLesson.id}`}
          className="w-full text-white py-4 px-4 rounded-xl font-bold transition-all text-center block hover:scale-105 hover:shadow-2xl text-base border-2 border-[#81b64c]"
          style={{
            background: 'linear-gradient(135deg, #81b64c, #a3d160)',
            boxShadow: '0 6px 20px rgba(129, 182, 76, 0.4)'
          }}
        >
          🎯 Continue: {nextLesson.title}
        </Link>
      )}
    </div>
  );

  const DailyChallengeCard = () => {
    if (!dailyChallenge) return null;

    const isCompleted = dailyChallenge.user_completion?.completed;

    return (
      <div className="tutorial-stats-card bg-[#312e2b] rounded-2xl shadow-lg border-2 border-[#3d3a37] p-6">
        <h3 className="text-2xl font-extrabold mb-5 text-white">🏅 Daily Challenge</h3>

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-3">
            <div className="text-4xl">{dailyChallenge.challenge_type_icon}</div>
            <div>
              <div className="font-bold text-white text-base">{dailyChallenge.challenge_type_display}</div>
              <div className={`text-sm px-3 py-1.5 rounded-lg text-xs font-bold text-white ${dailyChallenge.tier_color_class} mt-1 inline-block shadow-md`}>
                {getTierName(dailyChallenge.skill_tier)}
              </div>
            </div>
          </div>
          <div className="text-right p-3 bg-[#3d3a37] rounded-xl border-2 border-[#4a4744] shadow-sm">
            <div className="text-2xl font-extrabold text-[#e8a93e]">
              {dailyChallenge.xp_reward}
            </div>
            <div className="text-xs text-[#bababa] font-bold">XP</div>
          </div>
        </div>

        <div className="flex items-center text-base text-[#bababa] font-bold mb-5 bg-[#262421] p-2 rounded-lg">
          <span className="mr-2 text-xl">🏆</span>
          <span>{dailyChallenge.completion_count > 0 ? `${dailyChallenge.completion_count} players completed` : 'Be the first to solve today\'s puzzle!'}</span>
        </div>

        <Link
          to={`/tutorial/daily`}
          className="w-full py-4 px-4 rounded-xl font-bold transition-all text-center block text-white hover:scale-105 hover:shadow-2xl text-base border-2"
          style={{
            background: isCompleted ? 'linear-gradient(135deg, #81b64c, #a3d160)' : 'linear-gradient(135deg, #e8a93e, #f4c66a)',
            borderColor: isCompleted ? '#81b64c' : '#e8a93e',
            boxShadow: isCompleted ? '0 6px 20px rgba(129, 182, 76, 0.4)' : '0 6px 20px rgba(232, 169, 62, 0.5)'
          }}
        >
          {isCompleted ? '✅ Completed Today!' : '⚡ Start Challenge'}
        </Link>
      </div>
    );
  };

  // Show authentication error message if user is not authenticated
  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1a18]">
        <div className="text-center bg-[#312e2b] rounded-lg shadow-lg p-8 max-w-md mx-4">
          <div className="mb-4">
            <div className="mx-auto w-20 h-20 bg-[#3d3a37] rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-[#e8a93e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Login Required</h2>
          <p className="text-[#bababa] mb-6">Please login to access the chess tutorial modules and track your progress.</p>
          <div className="space-y-3">
            <Link
              to="/login"
              className="w-full inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-[#81b64c] hover:bg-[#a3d160] transition-colors duration-200"
            >
              🚀 Login to Continue
            </Link>
            <Link
              to="/register"
              className="w-full inline-flex justify-center items-center px-6 py-3 border border-[#4a4744] text-base font-medium rounded-md text-[#bababa] bg-[#3d3a37] hover:bg-[#4a4744] transition-colors duration-200"
            >
              📝 Create Account
            </Link>
          </div>
          <p className="mt-4 text-sm text-[#8b8987]">
            Don't have an account yet? Sign up for free and start learning chess!
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#81b64c] mx-auto mb-4"></div>
          <div className="text-lg font-medium text-[#bababa]">Loading Tutorial...</div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary errorMessage="The tutorial hub encountered an error. Please try reloading.">
      <div className="tutorial-container flex-grow bg-[#1a1a18] min-h-[calc(100vh-120px)] md:min-h-[calc(100vh-140px)] overflow-y-auto -webkit-overflow-scrolling-touch">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        {/* Completion Message */}
        {showCompletionMessage && (
          <div className="mb-6 bg-[#262421] border-l-4 border-[#81b64c] p-4 rounded-lg shadow-md animate-fade-in">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-[#81b64c]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-[#81b64c]">
                  🎉 Congratulations! Lesson Completed!
                </h3>
                <p className="mt-1 text-[#bababa]">
                  {location.state?.lessonTitle && `You've completed "${location.state.lessonTitle}"!`}
                  {location.state?.score !== undefined && (
                    <span className="ml-2 font-semibold">Score: {location.state.score}%</span>
                  )}
                </p>
                {location.state?.xpAwarded && (
                  <p className="mt-1 font-semibold text-[#a3d160]">
                    ⭐ +{location.state.xpAwarded} XP earned!
                  </p>
                )}
                {location.state?.moduleCompleted && (
                  <p className="mt-1 font-semibold text-[#a3d160]">
                    🏆 Module completed! Check your achievements.
                  </p>
                )}
                <p className="mt-1 text-sm text-[#8b8987]">
                  💡 Your progress has been automatically saved and your statistics updated.
                </p>
              </div>
              <button
                onClick={() => setShowCompletionMessage(false)}
                className="ml-auto flex-shrink-0 text-[#8b8987] hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-extrabold mb-4 text-white">🎓 Learn Chess</h1>
          <p className="text-xl text-[#bababa] font-semibold">Master the game with our interactive tutorials</p>
        </div>

        {/* Cross-link to Training Hub */}
        <div className="flex justify-center mb-6">
          <Link
            to="/training"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#262421] border border-[#3d3a37] text-[#bababa] hover:text-white hover:border-[#e8a93e] hover:bg-[#312e2b] transition-all text-sm font-semibold"
          >
            🏋️ Want puzzles &amp; exercises? Try Training Hub →
          </Link>
        </div>

        {/* Tier Filter */}
        <div className="flex justify-center mb-8">
          <div className="flex space-x-2 bg-[#262421] rounded-xl p-2 shadow-md border-2 border-[#3d3a37]">
            {['beginner', 'intermediate', 'advanced'].map((tier) => {
              const isActive = selectedTier === tier;
              const tierStyles = {
                beginner:     { bg: '#2a4a1e', border: '#81b64c', text: '#a3d160' },
                intermediate: { bg: '#1e3a5a', border: '#4a90d9', text: '#6db3f8' },
                advanced:     { bg: '#3a1e5a', border: '#9b59b6', text: '#c084fc' },
              };
              const ts = tierStyles[tier];
              return (
                <button
                  key={tier}
                  onClick={() => setSelectedTier(tier)}
                  className="px-6 py-3 rounded-lg font-bold transition-all"
                  style={isActive
                    ? { background: '#81b64c', color: '#fff', boxShadow: '0 4px 12px rgba(129,182,76,0.3)', transform: 'scale(1.05)' }
                    : { background: ts.bg, color: ts.text, border: `1px solid ${ts.border}40` }
                  }
                >
                  {getTierName(tier)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar — shows first on mobile so progress is visible immediately */}
          <div className="order-first lg:order-last space-y-6">
            <QuickStatsCard />
            <DailyChallengeCard />
          </div>

          {/* Modules Grid */}
          <div className="order-last lg:order-first lg:col-span-3">
            <div className="tutorial-modules-grid grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredModules.map((module, idx) => {
                // Find the closest preceding module that is unlocked — that's the prerequisite (T-R4)
                const prereq = idx > 0 ? filteredModules[idx - 1] : null;
                return (
                  <ModuleCard key={module.id} module={module} prerequisiteModule={prereq} />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
    </ErrorBoundary>
  );
};

export default TutorialHub;