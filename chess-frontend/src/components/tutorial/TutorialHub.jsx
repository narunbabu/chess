import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
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
  const [selectedTier, setSelectedTier] = useState('all');
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);

  useEffect(() => {
    // Check if we just completed a lesson
    if (location.state?.completed) {
      setShowCompletionMessage(true);
      // Clear the state to prevent showing the message again on refresh
      window.history.replaceState({}, document.title);

      // Hide the message after 5 seconds
      setTimeout(() => {
        setShowCompletionMessage(false);
      }, 5000);

      // Enhanced refresh with verified progress if available
      if (location.state?.verifiedProgress) {
        console.log('🎯 Using verified progress from lesson completion:', location.state.verifiedProgress);
        loadTutorialData(location.state.verifiedProgress);
      } else {
        console.log('🔄 Refreshing tutorial data after lesson completion');
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

      console.log('🔍 Tutorial Modules API Response:', modulesData);
      if (modulesData && modulesData.length > 0) {
        modulesData.forEach((module, index) => {
          console.log(`📊 Module ${index + 1} (${module.name}):`, {
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

          // 🔍 CROSS-CHECK: Verify module progress by counting lesson-level progress
          const lessonsList = module.lessons || module.activeLessons || [];
          const actualCompletedLessons = lessonsList?.filter(l =>
            l.user_progress?.status === 'completed' || l.user_progress?.status === 'mastered'
          ).length || 0;
          const actualTotalLessons = lessonsList?.length || 0;

          if (actualCompletedLessons !== module.user_progress?.completed_lessons) {
            console.warn(`⚠️ Module ${index + 1} progress mismatch!`, {
              moduleId: module.id,
              backend_completed: module.user_progress?.completed_lessons,
              frontend_count: actualCompletedLessons,
              backend_total: module.user_progress?.total_lessons,
              frontend_total: actualTotalLessons
            });

            // 🛠️ FIX: Override with frontend-calculated progress if there's a mismatch
            module.user_progress = {
              ...module.user_progress,
              completed_lessons: actualCompletedLessons,
              total_lessons: actualTotalLessons,
              percentage: actualTotalLessons > 0 ? round((actualCompletedLessons / actualTotalLessons) * 100, 2) : 0,
              is_completed: actualCompletedLessons === actualTotalLessons && actualTotalLessons > 0
            };

            console.log(`✅ Module ${index + 1} progress corrected:`, module.user_progress);
          }
        });
      }

      setModules(modulesData);

      // Load user progress and stats (or use verified progress)
      let progressData;
      if (verifiedProgress) {
        console.log('✅ Using verified progress from lesson completion');
        progressData = verifiedProgress;
      } else {
        const progressResponse = await api.get('/tutorial/progress');
        progressData = progressResponse.data.data;
        console.log('🔍 Tutorial Progress API Response:', progressData);
      }

      // Comprehensive API response structure handling
      let userStats = null;
      let nextLesson = null;

      if (progressData.stats) {
        // Primary expected structure
        userStats = progressData.stats;
        nextLesson = progressData.next_lesson;
        console.log('✅ Using primary stats structure');
      } else if (progressData.user_stats) {
        // Alternative structure
        userStats = progressData.user_stats;
        nextLesson = progressData.next_lesson;
        console.log('✅ Using user_stats structure');
      } else if (progressData.completed_lessons !== undefined) {
        // Direct progress object fallback
        userStats = {
          completed_lessons: progressData.completed_lessons,
          total_lessons: progressData.total_lessons || 9,
          completion_percentage: progressData.completion_percentage || 0,
          average_score: progressData.average_score || 0,
          current_streak: progressData.current_streak || 0,
          skill_tier: progressData.skill_tier || 'beginner',
          level: progressData.level || 1,
          xp: progressData.xp || 0,
          formatted_time_spent: progressData.formatted_time_spent || '0m'
        };
        nextLesson = progressData.next_lesson;
        console.log('✅ Using direct progress structure');
      } else {
        console.warn('⚠️ Unknown progress structure, using fallback');
        // Defensive fallback
        userStats = {
          completed_lessons: 0,
          total_lessons: 9,
          completion_percentage: 0,
          average_score: 0,
          current_streak: 0,
          skill_tier: 'beginner',
          level: 1,
          xp: 0,
          formatted_time_spent: '0m'
        };
      }

      console.log('📊 Final User Stats:', userStats);
      setStats(userStats);
      setNextLesson(nextLesson);

      // Load daily challenge
      const challengeResponse = await api.get('/tutorial/daily-challenge');
      setDailyChallenge(challengeResponse.data.data);

    } catch (error) {
      console.error('Error loading tutorial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModuleClick = (module) => {
    // Navigate to the module detail page to show all lessons
    navigate(`/tutorial/module/${module.slug}`);
  };

  const getTierColor = (tier) => {
    switch (tier) {
      case 'beginner': return 'bg-green-500';
      case 'intermediate': return 'bg-blue-500';
      case 'advanced': return 'bg-purple-600';
      default: return 'bg-gray-500';
    }
  };

  const getTierIcon = (tier) => {
    switch (tier) {
      case 'beginner': return '🌱';
      case 'intermediate': return '🎯';
      case 'advanced': return '🏆';
      default: return '📚';
    }
  };

  const getTierName = (tier) => {
    switch (tier) {
      case 'beginner': return 'Beginner';
      case 'intermediate': return 'Intermediate';
      case 'advanced': return 'Advanced';
      default: return 'All Levels';
    }
  };

  const filteredModules = selectedTier === 'all'
    ? modules
    : modules.filter(module => module.skill_tier === selectedTier);

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
        className={`unified-card relative ${isLocked ? 'opacity-75' : ''} ${
          module.skill_tier === 'beginner' ? 'tier-beginner' :
          module.skill_tier === 'intermediate' ? 'tier-intermediate' : 'tier-advanced'
        }`}
      >
        {/* Lock overlay */}
        {isLocked && (
          <div className="absolute inset-0 bg-gray-900 bg-opacity-50 rounded-lg flex items-center justify-center z-10">
            <div className="text-white text-center">
              <div className="text-3xl mb-2">🔒</div>
              <div className="text-sm font-medium">Complete previous lessons to unlock</div>
            </div>
          </div>
        )}

        {/* Module header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 ${getTierColor(module.skill_tier)} rounded-lg flex items-center justify-center text-white text-xl shadow-md`}>
              {module.icon || getTierIcon(module.skill_tier)}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">{module.name}</h3>
              <span className={`inline-block px-2 py-1 rounded text-xs font-semibold text-white ${getTierColor(module.skill_tier)} shadow-sm`}>
                {getTierName(module.skill_tier)}
              </span>
            </div>
          </div>
          <div className="text-right">
            <CircularProgress percentage={progress.percentage} size={60} />
          </div>
        </div>

        {/* Module info */}
        <p className="text-gray-700 mb-4 text-sm font-medium">{module.description}</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50">
            <div className="text-2xl font-bold" style={{ background: 'var(--tutorial-gradient-green)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {progress.completed_lessons}
            </div>
            <div className="text-xs font-medium text-gray-600">✓ Done</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50">
            <div className="text-2xl font-bold" style={{ background: 'var(--tutorial-gradient-purple)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {progress.total_lessons}
            </div>
            <div className="text-xs font-medium text-gray-600">📚 Total</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-gradient-to-br from-yellow-50 to-amber-50">
            <div className="text-2xl font-bold" style={{ background: 'var(--tutorial-xp-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {module.total_xp}
            </div>
            <div className="text-xs font-medium text-gray-600">⭐ XP</div>
          </div>
        </div>

        {/* Duration */}
        <div className="flex items-center text-sm text-gray-700 font-medium mb-4">
          <span className="mr-2">⏱️</span>
          <span>{module.formatted_duration}</span>
        </div>

        {/* Action button */}
        {isLocked ? (
          <button
            className="w-full py-3 px-4 rounded-lg font-semibold transition-colors text-center bg-gray-300 text-gray-600 cursor-not-allowed"
            disabled
          >
            🔒 Locked
          </button>
        ) : (
          <button
            onClick={() => handleModuleClick(module)}
            className="w-full py-3 px-4 rounded-lg font-semibold transition-all text-center text-white hover:scale-105 hover:shadow-lg"
            style={{
              background: progress.is_completed ? 'var(--tutorial-gradient-green)' : 'var(--tutorial-gradient-purple)',
              boxShadow: progress.is_completed ? '0 4px 15px rgba(34, 197, 94, 0.3)' : '0 4px 15px rgba(124, 58, 237, 0.3)'
            }}
          >
            {progress.is_completed ? '✅ Review Lessons' : progress.completed_lessons > 0 ? '🚀 Continue Learning' : '📖 View Lessons'}
          </button>
        )}
      </div>
    );
  };

  const QuickStatsCard = () => (
    <div className="unified-card">
      <h3 className="text-lg font-bold mb-4 text-gray-800">📊 Your Progress</h3>

      {/* XP and Level */}
      <div className="mb-6 p-3 bg-gray-50 rounded-lg">
        <XPProgressBar xp={stats?.xp || 0} level={stats?.level || 1} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center p-3 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 hover:shadow-md transition-all">
          <div className="text-3xl font-bold" style={{ background: 'var(--tutorial-gradient-green)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            {stats?.completed_lessons || 0}
          </div>
          <div className="text-xs font-medium text-gray-600 mt-1">✅ Lessons</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 hover:shadow-md transition-all">
          <div className="text-3xl font-bold" style={{ background: 'var(--tutorial-gradient-purple)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            {stats?.achievements_count || 0}
          </div>
          <div className="text-xs font-medium text-gray-600 mt-1">🏆 Achievements</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-gradient-to-br from-orange-50 to-amber-50 hover:shadow-md transition-all">
          <div className="text-3xl font-bold" style={{ background: 'var(--tutorial-xp-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            {stats?.current_streak || 0}
          </div>
          <div className="text-xs font-medium text-gray-600 mt-1">🔥 Day Streak</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-gradient-to-br from-blue-50 to-sky-50 hover:shadow-md transition-all">
          <div className="text-3xl font-bold" style={{ background: 'var(--tutorial-gradient-blue)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            {stats?.completion_percentage || 0}%
          </div>
          <div className="text-xs font-medium text-gray-600 mt-1">📊 Progress</div>
        </div>
      </div>

      {/* Continue Learning */}
      {nextLesson && (
        <Link
          to={`/tutorial/lesson/${nextLesson.id}`}
          className="w-full text-white py-3 px-4 rounded-lg font-semibold transition-all text-center block hover:scale-105 hover:shadow-lg"
          style={{
            background: 'var(--tutorial-gradient-green)',
            boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)'
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
      <div className="unified-card">
        <h3 className="text-lg font-bold mb-4 text-gray-800">🏅 Daily Challenge</h3>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="text-3xl">{dailyChallenge.challenge_type_icon}</div>
            <div>
              <div className="font-semibold text-gray-800">{dailyChallenge.challenge_type_display}</div>
              <div className={`text-sm px-2 py-1 rounded text-xs font-medium text-white ${dailyChallenge.tier_color_class}`}>
                {getTierName(dailyChallenge.skill_tier)}
              </div>
            </div>
          </div>
          <div className="text-right p-3 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold" style={{
              background: 'var(--tutorial-xp-gradient)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              {dailyChallenge.xp_reward}
            </div>
            <div className="text-xs text-gray-600 font-semibold">XP</div>
          </div>
        </div>

        <div className="flex items-center text-sm text-gray-700 font-medium mb-4">
          <span className="mr-2">🏆</span>
          <span>{dailyChallenge.completion_count} players completed</span>
        </div>

        <Link
          to={`/tutorial/daily`}
          className="w-full py-3 px-4 rounded-lg font-semibold transition-all text-center block text-white hover:scale-105 hover:shadow-lg"
          style={{
            background: isCompleted ? 'var(--tutorial-gradient-green)' : 'var(--tutorial-gradient-orange)',
            boxShadow: isCompleted ? '0 4px 15px rgba(34, 197, 94, 0.3)' : '0 4px 15px rgba(249, 115, 22, 0.4)'
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
        <h1 className="text-4xl font-bold mb-4 text-gray-800">🎓 Learn Chess</h1>
        <p className="text-lg text-gray-700 font-medium">Master the game with our interactive tutorials</p>
      </div>

      {/* Tier Filter */}
      <div className="flex justify-center mb-8">
        <div className="flex space-x-2 bg-gray-100 rounded-lg p-1">
          {['all', 'beginner', 'intermediate', 'advanced'].map((tier) => (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                selectedTier === tier
                  ? 'bg-white shadow-sm text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
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
  );
};

export default TutorialHub;