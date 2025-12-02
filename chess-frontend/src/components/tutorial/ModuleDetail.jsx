import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import ErrorBoundary from './ErrorBoundary';
import '../../styles/UnifiedCards.css';

const ModuleDetail = () => {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [module, setModule] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadModuleData();
  }, [slug]);

  const loadModuleData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/tutorial/modules/${slug}?_t=${Date.now()}`);
      const moduleData = response.data.data;
      setModule(moduleData);

      // Debug logging
      console.log('📚 Module Detail:', moduleData);
      console.log('📚 Module unlocked?', moduleData.is_unlocked);
      console.log('📚 Lessons count:', moduleData.lessons?.length || moduleData.activeLessons?.length);

      // Log each lesson's unlock status
      const lessons = moduleData.lessons || moduleData.activeLessons || [];
      lessons.forEach((lesson, index) => {
        console.log(`📚 Lesson ${index + 1}: ${lesson.title}`);
        console.log(`  - is_unlocked: ${lesson.is_unlocked}`);
        console.log(`  - user_progress:`, lesson.user_progress);
        console.log(`  - calculated isLocked: ${!lesson.is_unlocked}`);
      });
    } catch (error) {
      console.error('Error loading module:', error);
    } finally {
      setLoading(false);
    }
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

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
      case 'mastered':
        return '✅';
      case 'in_progress':
        return '🔄';
      default:
        return '⭐';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'mastered':
        return 'Mastered';
      case 'in_progress':
        return 'In Progress';
      default:
        return 'Not Started';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
      case 'mastered':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg font-medium">Loading Module...</div>
        </div>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <div className="text-lg font-medium">Module not found</div>
          <Link to="/tutorial" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            ← Back to Tutorial Hub
          </Link>
        </div>
      </div>
    );
  }

  // IMPORTANT: Use the correct 'lessons' key that the API now returns
  // The API returns both 'active_lessons' (without unlock status) and 'lessons' (with unlock status)
  const lessons = module.lessons || [];
  const progress = module.user_progress || {};

  // Debug logging
  console.log('🎯 Rendering module:', module.name);
  console.log('🎯 Available lesson keys:', Object.keys(module).filter(k => k.includes('lesson')));
  console.log('🎯 Using lessons array length:', lessons.length);
  console.log('🎯 First lesson unlock status:', lessons[0]?.is_unlocked);

  // Force use of the unlocked lessons data
  const finalLessons = lessons.length > 0 ? lessons : (module.active_lessons || module.activeLessons || []);
  console.log('🎯 Final lessons array:', finalLessons);

  return (
    <ErrorBoundary errorMessage="The module details encountered an error. Please try reloading.">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Link
          to="/tutorial"
          className="inline-flex items-center bg-white text-blue-600 hover:text-blue-800 hover:bg-blue-50 mb-6 font-semibold px-4 py-2 rounded-lg shadow-sm transition-all"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Tutorial Hub
        </Link>

        {/* Module Header */}
        <div className="bg-white rounded-2xl shadow-lg mb-8 p-6 border-2 border-blue-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className={`w-20 h-20 ${getTierColor(module.skill_tier)} rounded-xl flex items-center justify-center text-white text-3xl shadow-lg transform hover:scale-110 transition-transform`}>
                {module.icon || getTierIcon(module.skill_tier)}
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">{module.name}</h1>
                <p className="text-gray-700 font-semibold text-lg">{module.description}</p>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex justify-between text-base font-bold text-gray-800 mb-3">
              <span>Progress: {progress.completed_lessons || 0}/{progress.total_lessons || 0} lessons</span>
              <span className="text-blue-600">{progress.percentage || 0}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 relative overflow-hidden shadow-inner">
              <div
                className="h-4 rounded-full transition-all duration-500"
                style={{
                  width: `${progress.percentage || 0}%`,
                  background: 'linear-gradient(90deg, #10b981, #34d399)',
                  boxShadow: '0 0 15px rgba(34, 197, 94, 0.8)'
                }}
              />
            </div>
          </div>

          {/* Module Stats */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 border-2 border-purple-200 shadow-md hover:shadow-lg transition-shadow">
              <div className="text-3xl font-extrabold text-purple-700">
                {progress.completed_lessons || 0}/{progress.total_lessons || 0}
              </div>
              <div className="text-sm font-bold text-gray-700 mt-1">✓ Done</div>
            </div>
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 border-2 border-green-200 shadow-md hover:shadow-lg transition-shadow">
              <div className="text-3xl font-extrabold text-green-700">
                {progress.earned_xp || 0}/{module.total_xp || 0}
              </div>
              <div className="text-sm font-bold text-gray-700 mt-1">⭐ XP</div>
            </div>
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-blue-100 to-sky-100 border-2 border-blue-200 shadow-md hover:shadow-lg transition-shadow">
              <div className="text-3xl font-extrabold text-blue-700">
                {progress.average_score ? `${Math.round(progress.average_score)}%` : '-'}
              </div>
              <div className="text-sm font-bold text-gray-700 mt-1">📊 Avg Score</div>
            </div>
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 border-2 border-amber-200 shadow-md hover:shadow-lg transition-shadow">
              <div className="text-3xl font-extrabold text-amber-700">
                {module.formatted_duration || '0m'}
              </div>
              <div className="text-sm font-bold text-gray-700 mt-1">⏱️ Time</div>
            </div>
          </div>
        </div>

        {/* Lessons List */}
        <div className="space-y-4">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">📖 Lessons</h2>
          {finalLessons.map((lesson, index) => {
            const lessonProgress = lesson.progress || lesson.user_progress || {};
            const status = lessonProgress.status || 'not_started';

            // Use the lesson's is_unlocked status if available, otherwise assume unlocked (for fallback data)
            const isLocked = lesson.is_unlocked !== undefined ? !lesson.is_unlocked : false;

            // Debug logging for each lesson
            console.log(`🔍 Lesson ${index + 1} "${lesson.title}":`, {
              id: lesson.id,
              is_unlocked: lesson.is_unlocked,
              user_progress: lesson.user_progress,
              status: status,
              isLocked: isLocked,
              source: lesson.is_unlocked !== undefined ? 'api_unlock_data' : 'fallback_unlocked'
            });

            return (
              <div
                key={lesson.id}
                className={`bg-white rounded-xl shadow-md border-2 border-gray-100 hover:border-blue-200 hover:shadow-xl transition-all p-5 flex items-center justify-between ${isLocked ? 'opacity-60 bg-gray-50' : ''}`}
              >
                {/* Lesson Number and Icon */}
                <div className="flex items-center space-x-4 flex-1">
                  <div className="text-4xl">{getStatusIcon(status)}</div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2 flex-wrap">
                      <h3 className="text-xl font-bold text-gray-900">
                        {index + 1}. {lesson.title}
                      </h3>
                      <span className={`px-4 py-1.5 rounded-full text-sm font-bold border-2 ${getStatusColor(status)}`}>
                        {getStatusText(status)}
                      </span>
                    </div>
                    <p className="text-gray-700 text-base font-medium mb-3">{lesson.description}</p>
                    <div className="flex items-center space-x-6 text-sm font-semibold text-gray-700">
                      <span className="flex items-center gap-1">⏱️ {lesson.estimated_duration || '5'} min</span>
                      <span className="flex items-center gap-1">⭐ {lesson.xp_reward || 20} XP</span>
                      {lessonProgress.best_score !== undefined && lessonProgress.best_score > 0 && (
                        <span className="flex items-center gap-1 text-blue-600">📊 Score: {Math.round(lessonProgress.best_score)}%</span>
                      )}
                      {(status === 'completed' || status === 'mastered') && lesson.xp_reward && (
                        <span className="flex items-center gap-1 text-green-600">✅ Earned: {lesson.xp_reward} XP</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="ml-4">
                  {isLocked ? (
                    <button
                      className="px-6 py-3 rounded-xl font-bold bg-gray-300 text-gray-600 cursor-not-allowed border-2 border-gray-400"
                      disabled
                    >
                      🔒 Locked
                    </button>
                  ) : (
                    <Link
                      to={`/tutorial/lesson/${lesson.id}`}
                      className="px-6 py-3 rounded-xl font-bold text-white transition-all hover:scale-105 hover:shadow-xl inline-block border-2"
                      style={{
                        background: status === 'completed' || status === 'mastered'
                          ? 'linear-gradient(135deg, #3b82f6, #60a5fa)'
                          : status === 'in_progress'
                          ? 'linear-gradient(135deg, #10b981, #34d399)'
                          : 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
                        borderColor: status === 'completed' || status === 'mastered'
                          ? '#3b82f6'
                          : status === 'in_progress'
                          ? '#10b981'
                          : '#8b5cf6',
                        boxShadow: '0 4px 15px rgba(124, 58, 237, 0.4)'
                      }}
                    >
                      {status === 'completed' || status === 'mastered' ? '🔄 Review' :
                       status === 'in_progress' ? '▶️ Continue' : '🚀 Start'}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </ErrorBoundary>
  );
};

export default ModuleDetail;
