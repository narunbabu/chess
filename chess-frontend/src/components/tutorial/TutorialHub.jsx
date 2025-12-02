import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import logger from '../../utils/logger';
import { DEFAULTS, TIMING, getTierColor, getTierIcon, getTierName } from '../../constants/tutorialConstants';
import ErrorBoundary from './ErrorBoundary';
import '../../styles/UnifiedCards.css';

const TutorialHub = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [modules, setModules] = useState([]);
  const [stats, setStats] = useState(null);
  const [nextLesson, setNextLesson] = useState(null);
  const [dailyChallenge, setDailyChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState('beginner');
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);

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
        <div className="flex justify-between text-sm mb-1 font-semibold text-gray-700">
          <span>🎖️ Level {level}</span>
          <span>⭐ {xp} XP</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-200 via-yellow-100 to-orange-200 opacity-30"></div>
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
            className="text-gray-200"
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

  const ModuleCard = ({ module }) => {
    const isLocked = !module.is_unlocked;
    const progress = module.user_progress;

    return (
      <div
        key={module.id}
        className={`bg-white rounded-2xl shadow-lg border-2 border-blue-100 hover:border-blue-300 hover:shadow-2xl transition-all p-6 relative ${isLocked ? 'opacity-75' : ''}`}
      >
        {/* Lock overlay */}
        {isLocked && (
          <div className="absolute inset-0 bg-gray-900 bg-opacity-70 rounded-2xl flex items-center justify-center z-10">
            <div className="text-white text-center">
              <div className="text-4xl mb-3">🔒</div>
              <div className="text-base font-bold">Complete previous lessons to unlock</div>
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
              <h3 className="text-xl font-extrabold text-gray-900">{module.name}</h3>
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
        <p className="text-gray-700 mb-5 text-base font-semibold">{module.description}</p>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          <div className="text-center p-3 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 border-2 border-green-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-2xl font-extrabold text-green-700">
              {progress.completed_lessons}
            </div>
            <div className="text-xs font-bold text-gray-700 mt-1">✓ Done</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 border-2 border-purple-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-2xl font-extrabold text-purple-700">
              {progress.total_lessons}
            </div>
            <div className="text-xs font-bold text-gray-700 mt-1">📚 Total</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-gradient-to-br from-yellow-100 to-amber-100 border-2 border-yellow-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-xl font-extrabold text-yellow-700">
              {progress.earned_xp || 0}/{module.total_xp}
            </div>
            <div className="text-xs font-bold text-gray-700 mt-1">⭐ XP</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-gradient-to-br from-blue-100 to-sky-100 border-2 border-blue-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-2xl font-extrabold text-blue-700">
              {progress.average_score ? `${Math.round(progress.average_score)}%` : '-'}
            </div>
            <div className="text-xs font-bold text-gray-700 mt-1">📊 Score</div>
          </div>
        </div>

        {/* Duration */}
        <div className="flex items-center text-base text-gray-800 font-bold mb-5 bg-gray-50 p-2 rounded-lg">
          <span className="mr-2 text-xl">⏱️</span>
          <span>{module.formatted_duration}</span>
        </div>

        {/* Action button */}
        {isLocked ? (
          <button
            className="w-full py-4 px-4 rounded-xl font-bold transition-colors text-center bg-gray-300 text-gray-700 cursor-not-allowed border-2 border-gray-400 text-lg"
            disabled
          >
            🔒 Locked
          </button>
        ) : (
          <button
            onClick={() => handleModuleClick(module)}
            className="w-full py-4 px-4 rounded-xl font-bold transition-all text-center text-white hover:scale-105 hover:shadow-2xl text-lg border-2"
            style={{
              background: progress.is_completed ? 'linear-gradient(135deg, #10b981, #34d399)' : 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
              borderColor: progress.is_completed ? '#10b981' : '#8b5cf6',
              boxShadow: progress.is_completed ? '0 6px 20px rgba(34, 197, 94, 0.4)' : '0 6px 20px rgba(124, 58, 237, 0.4)'
            }}
          >
            {progress.is_completed ? '✅ Review Lessons' : progress.completed_lessons > 0 ? '🚀 Continue Learning' : '📖 View Lessons'}
          </button>
        )}
      </div>
    );
  };

  const QuickStatsCard = () => (
    <div className="bg-white rounded-2xl shadow-lg border-2 border-blue-100 p-6">
      <h3 className="text-2xl font-extrabold mb-5 text-gray-900">📊 Your Progress</h3>

      {/* XP and Level */}
      <div className="mb-6 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border-2 border-indigo-200 shadow-sm">
        <XPProgressBar xp={stats?.earned_xp || stats?.xp || 0} level={stats?.level || 1} />
        {stats?.earned_xp !== stats?.xp && (
          <div className="mt-2 text-xs text-gray-600 text-center">
            <span className="font-semibold">Total XP (with bonuses): {stats?.xp || 0}</span>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="text-center p-3 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 border-2 border-green-200 hover:shadow-lg hover:scale-105 transition-all">
          <div className="text-3xl font-extrabold text-green-700">
            {stats?.completed_lessons || 0}
          </div>
          <div className="text-xs font-bold text-gray-700 mt-1">✅ Lessons</div>
        </div>
        <div className="text-center p-3 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 border-2 border-purple-200 hover:shadow-lg hover:scale-105 transition-all">
          <div className="text-3xl font-extrabold text-purple-700">
            {stats?.achievements_count || 0}
          </div>
          <div className="text-xs font-bold text-gray-700 mt-1">🏆 Achievements</div>
        </div>
        <div className="text-center p-3 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 border-2 border-orange-200 hover:shadow-lg hover:scale-105 transition-all">
          <div className="text-3xl font-extrabold text-orange-700">
            {stats?.current_streak || 0}
          </div>
          <div className="text-xs font-bold text-gray-700 mt-1">🔥 Day Streak</div>
        </div>
        <div className="text-center p-3 rounded-xl bg-gradient-to-br from-blue-100 to-sky-100 border-2 border-blue-200 hover:shadow-lg hover:scale-105 transition-all">
          <div className="text-3xl font-extrabold text-blue-700">
            {stats?.completion_percentage || 0}%
          </div>
          <div className="text-xs font-bold text-gray-700 mt-1">📊 Progress</div>
        </div>
      </div>

      {/* Continue Learning */}
      {nextLesson && (
        <Link
          to={`/tutorial/lesson/${nextLesson.id}`}
          className="w-full text-white py-4 px-4 rounded-xl font-bold transition-all text-center block hover:scale-105 hover:shadow-2xl text-base border-2 border-green-600"
          style={{
            background: 'linear-gradient(135deg, #10b981, #34d399)',
            boxShadow: '0 6px 20px rgba(34, 197, 94, 0.4)'
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
      <div className="bg-white rounded-2xl shadow-lg border-2 border-blue-100 p-6">
        <h3 className="text-2xl font-extrabold mb-5 text-gray-900">🏅 Daily Challenge</h3>

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-3">
            <div className="text-4xl">{dailyChallenge.challenge_type_icon}</div>
            <div>
              <div className="font-bold text-gray-900 text-base">{dailyChallenge.challenge_type_display}</div>
              <div className={`text-sm px-3 py-1.5 rounded-lg text-xs font-bold text-white ${dailyChallenge.tier_color_class} mt-1 inline-block shadow-md`}>
                {getTierName(dailyChallenge.skill_tier)}
              </div>
            </div>
          </div>
          <div className="text-right p-3 bg-gradient-to-br from-yellow-100 to-amber-100 rounded-xl border-2 border-yellow-200 shadow-sm">
            <div className="text-2xl font-extrabold text-yellow-700">
              {dailyChallenge.xp_reward}
            </div>
            <div className="text-xs text-gray-700 font-bold">XP</div>
          </div>
        </div>

        <div className="flex items-center text-base text-gray-800 font-bold mb-5 bg-gray-50 p-2 rounded-lg">
          <span className="mr-2 text-xl">🏆</span>
          <span>{dailyChallenge.completion_count} players completed</span>
        </div>

        <Link
          to={`/tutorial/daily`}
          className="w-full py-4 px-4 rounded-xl font-bold transition-all text-center block text-white hover:scale-105 hover:shadow-2xl text-base border-2"
          style={{
            background: isCompleted ? 'linear-gradient(135deg, #10b981, #34d399)' : 'linear-gradient(135deg, #f97316, #fb923c)',
            borderColor: isCompleted ? '#10b981' : '#f97316',
            boxShadow: isCompleted ? '0 6px 20px rgba(34, 197, 94, 0.4)' : '0 6px 20px rgba(249, 115, 22, 0.5)'
          }}
        >
          {isCompleted ? '✅ Completed Today!' : '⚡ Start Challenge'}
        </Link>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg font-medium">Loading Tutorial...</div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary errorMessage="The tutorial hub encountered an error. Please try reloading.">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="container mx-auto px-4 py-8">
        {/* Completion Message */}
        {showCompletionMessage && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 rounded-lg shadow-md animate-fade-in">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-green-800">
                  🎉 Congratulations! Lesson Completed!
                </h3>
                <p className="mt-1 text-green-700">
                  {location.state?.lessonTitle && `You've completed "${location.state.lessonTitle}"!`}
                  {location.state?.score !== undefined && (
                    <span className="ml-2 font-semibold">Score: {location.state.score}%</span>
                  )}
                </p>
                {location.state?.xpAwarded && (
                  <p className="mt-1 font-semibold text-green-700">
                    ⭐ +{location.state.xpAwarded} XP earned!
                  </p>
                )}
                {location.state?.moduleCompleted && (
                  <p className="mt-1 font-semibold text-green-700">
                    🏆 Module completed! Check your achievements.
                  </p>
                )}
                <p className="mt-1 text-sm text-green-600">
                  💡 Your progress has been automatically saved and your statistics updated.
                </p>
              </div>
              <button
                onClick={() => setShowCompletionMessage(false)}
                className="ml-auto flex-shrink-0 text-green-500 hover:text-green-700"
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
          <h1 className="text-5xl font-extrabold mb-4 text-gray-900">🎓 Learn Chess</h1>
          <p className="text-xl text-gray-700 font-semibold">Master the game with our interactive tutorials</p>
        </div>

        {/* Tier Filter */}
        <div className="flex justify-center mb-8">
          <div className="flex space-x-2 bg-white rounded-xl p-2 shadow-md border-2 border-gray-200">
            {['beginner', 'intermediate', 'advanced'].map((tier) => (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier)}
                className={`px-6 py-3 rounded-lg font-bold transition-all ${
                  selectedTier === tier
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 shadow-lg text-white transform scale-105'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {getTierName(tier)}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Modules Grid */}
          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredModules.map((module) => (
                <ModuleCard key={module.id} module={module} />
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <QuickStatsCard />
            <DailyChallengeCard />
          </div>
        </div>
      </div>
    </div>
    </ErrorBoundary>
  );
};

export default TutorialHub;