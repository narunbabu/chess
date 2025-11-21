<?php

namespace App\Http\Controllers;

use App\Models\TutorialModule;
use App\Models\TutorialLesson;
use App\Models\UserTutorialProgress;
use App\Models\TutorialAchievement;
use App\Models\UserAchievement;
use App\Models\DailyChallenge;
use App\Models\UserDailyChallengeCompletion;
use App\Models\UserSkillAssessment;
use App\Models\TutorialPracticeGame;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class TutorialController extends Controller
{
    /**
     * Get all tutorial modules with user progress
     */
    public function getModules(Request $request): JsonResponse
    {
        $user = Auth::user();
        $tier = $request->query('tier'); // Optional tier filter

        $query = TutorialModule::active()
            ->with(['activeLessons' => function ($query) use ($user) {
                $query->with(['userProgress' => function ($query) use ($user) {
                    $query->where('user_id', $user->id);
                }]);
            }])
            ->with(['unlockRequirement']);

        if ($tier) {
            $query->byTier($tier);
        }

        $modules = $query->orderBy('skill_tier')
            ->orderBy('sort_order')
            ->get();

        // Add user progress to each module
        $modulesWithProgress = $modules->map(function ($module) use ($user) {
            $progress = $module->getUserProgress($user->id);
            $isUnlocked = $module->isUnlockedFor($user->id);

            // Add unlock status and progress info to lessons
            $lessonsWithProgress = $module->activeLessons->map(function ($lesson) use ($user) {
                $isLessonUnlocked = $lesson->isUnlockedFor($user->id);
                $lessonUserProgress = $lesson->getUserProgress($user->id);

                return array_merge($lesson->toArray(), [
                    'is_unlocked' => $isLessonUnlocked,
                    'user_progress' => $lessonUserProgress,
                    'formatted_duration' => $lesson->formatted_duration,
                    'difficulty_level' => $lesson->difficulty_level,
                ]);
            });

            $moduleData = $module->toArray();
            $moduleData['lessons'] = $lessonsWithProgress->toArray(); // Add lessons with progress
            $moduleData['user_progress'] = $progress;
            $moduleData['is_unlocked'] = $isUnlocked;
            $moduleData['total_xp'] = $module->total_xp;
            $moduleData['formatted_duration'] = $module->formatted_duration;

            return $moduleData;
        });

        return response()->json([
            'success' => true,
            'data' => $modulesWithProgress,
        ]);
    }

    /**
     * Get single module with lessons and progress
     */
    public function getModule($slug): JsonResponse
    {
        $user = Auth::user();

        $module = TutorialModule::active()
            ->with(['activeLessons' => function ($query) use ($user) {
                $query->with(['userProgress' => function ($query) use ($user) {
                    $query->where('user_id', $user->id);
                }]);
            }])
            ->with(['unlockRequirement'])
            ->where('slug', $slug)
            ->firstOrFail();

        // Add unlock status and progress info to lessons
        $lessonsWithProgress = $module->activeLessons->map(function ($lesson) use ($user) {
            $isUnlocked = $lesson->isUnlockedFor($user->id);
            $userProgress = $lesson->getUserProgress($user->id);

            return array_merge($lesson->toArray(), [
                'is_unlocked' => $isUnlocked,
                'user_progress' => $userProgress,
                'formatted_duration' => $lesson->formatted_duration,
                'difficulty_level' => $lesson->difficulty_level,
            ]);
        });

        $moduleData = $module->toArray();
        $moduleData['lessons'] = $lessonsWithProgress; // Use 'lessons' key for consistency
        $moduleData['user_progress'] = $module->getUserProgress($user->id);
        $moduleData['is_unlocked'] = $module->isUnlockedFor($user->id);

        return response()->json([
            'success' => true,
            'data' => $moduleData,
        ]);
    }

    /**
     * Get lesson content
     */
    public function getLesson($id): JsonResponse
    {
        $user = Auth::user();

        $lesson = TutorialLesson::active()
            ->with(['module', 'unlockRequirement'])
            ->findOrFail($id);

        // Check if lesson is unlocked for user
        if (!$lesson->isUnlockedFor($user->id)) {
            return response()->json([
                'success' => false,
                'message' => 'This lesson is locked. Complete previous lessons to unlock it.',
            ], 403);
        }

        // Get or create user progress
        $progress = $lesson->getUserProgress($user->id);
        if (!$progress) {
            $progress = $lesson->userProgress()->create([
                'user_id' => $user->id,
                'status' => 'not_started',
            ]);
        }

        // Update last accessed time
        if ($progress->status === 'not_started') {
            $progress->markAsStarted();
        } else {
            $progress->update(['last_accessed_at' => now()]);
        }

        return response()->json([
            'success' => true,
            'data' => array_merge($lesson->toArray(), [
                'user_progress' => $progress,
                'formatted_duration' => $lesson->formatted_duration,
                'difficulty_level' => $lesson->difficulty_level,
                'is_unlocked' => true,
            ]),
        ]);
    }

    /**
     * Start a lesson
     */
    public function startLesson($id): JsonResponse
    {
        $user = Auth::user();

        $lesson = TutorialLesson::active()->findOrFail($id);

        if (!$lesson->isUnlockedFor($user->id)) {
            return response()->json([
                'success' => false,
                'message' => 'This lesson is locked.',
            ], 403);
        }

        $progress = $lesson->getUserProgress($user->id);
        if (!$progress) {
            $progress = $lesson->userProgress()->create([
                'user_id' => $user->id,
                'status' => 'in_progress',
                'attempts' => 1,
            ]);
        } elseif ($progress->status === 'not_started') {
            $progress->markAsStarted();
        }

        return response()->json([
            'success' => true,
            'data' => $progress,
        ]);
    }

    /**
     * Complete a lesson
     */
    public function completeLesson(Request $request, $id): JsonResponse
    {
        try {
            $request->validate([
                'score' => 'required|numeric|min:0|max:100',
                'time_spent_seconds' => 'required|integer|min:0',
                'attempts' => 'nullable|integer|min:0',
            ]);

            $user = Auth::user();
            $lesson = TutorialLesson::active()->findOrFail($id);

            $progress = $lesson->getUserProgress($user->id);
            if (!$progress) {
                return response()->json([
                    'success' => false,
                    'message' => 'Lesson progress not found. Start the lesson first.',
                ], 404);
            }

            // Update user's daily streak
            try {
                $user->updateDailyStreak();
            } catch (\Exception $e) {
                \Log::error('Error updating daily streak', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString()
                ]);
                // Continue even if streak update fails
            }

            // Mark lesson as completed
            try {
                $progress->markAsCompleted(
                    $request->score,
                    $request->time_spent_seconds
                );
            } catch (\Exception $e) {
                \Log::error('Error marking lesson as completed', [
                    'user_id' => $user->id,
                    'lesson_id' => $lesson->id,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString()
                ]);
                throw $e; // Re-throw as this is critical
            }

            // Check for module completion
            $moduleProgress = $lesson->module->getUserProgress($user->id);
            $allCompleted = $moduleProgress['is_completed'];

            return response()->json([
                'success' => true,
                'data' => [
                    'progress' => $progress->fresh(),
                    'xp_awarded' => $lesson->xp_reward,
                    'module_completed' => $allCompleted,
                    'user_stats' => $user->tutorial_stats,
                ],
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            \Log::error('Validation error in completeLesson', [
                'errors' => $e->errors(),
                'input' => $request->all()
            ]);
            throw $e;
        } catch (\Exception $e) {
            \Log::error('Unexpected error in completeLesson', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'input' => $request->all()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'An error occurred while completing the lesson: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get user's overall tutorial progress
     */
    public function getProgress(): JsonResponse
    {
        $user = Auth::user();

        $stats = $user->tutorial_stats;
        $xpProgress = $user->xp_progress;
        $currentStreak = $user->getCurrentDailyStreak();

        // Get recent achievements
        $recentAchievements = $user->userAchievements()
            ->with('achievement')
            ->recent(7)
            ->orderBy('earned_at', 'desc')
            ->limit(5)
            ->get();

        // Get next lesson to continue
        $nextLesson = $this->getNextLesson($user);

        return response()->json([
            'success' => true,
            'data' => [
                'stats' => $stats,
                'xp_progress' => $xpProgress,
                'current_streak' => $currentStreak,
                'recent_achievements' => $recentAchievements->toArray(),
                'next_lesson' => $nextLesson,
            ],
        ]);
    }

    /**
     * Get user's detailed statistics
     */
    public function getStats(): JsonResponse
    {
        $user = Auth::user();

        $stats = $user->tutorial_stats;

        // Add practice game stats
        $practiceStats = [
            'total_games' => $user->tutorialPracticeGames()->count(),
            'win_rate' => TutorialPracticeGame::getWinRateForUser($user->id),
            'average_moves' => TutorialPracticeGame::getAverageMovesForUser($user->id),
        ];

        // Add skill assessment history
        $assessments = $user->skillAssessments()
            ->orderByDesc('completed_at')
            ->limit(5)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'stats' => $stats,
                'practice_stats' => $practiceStats,
                'recent_assessments' => $assessments->toArray(),
            ],
        ]);
    }

    /**
     * Get achievements
     */
    public function getAchievements(Request $request): JsonResponse
    {
        $user = Auth::user();
        $tier = $request->query('tier');

        $query = TutorialAchievement::active();
        if ($tier) {
            $query->byTier($tier);
        }

        $achievements = $query->orderBy('tier')
            ->orderBy('requirement_value')
            ->get();

        // Add user progress to each achievement
        $achievementsWithProgress = $achievements->map(function ($achievement) use ($user) {
            $progress = $achievement->getProgressForUser($user->id);
            $isEarned = $achievement->isEarnedBy($user->id);

            return array_merge($achievement->toArray(), [
                'progress' => $progress,
                'is_earned' => $isEarned,
                'tier_color_class' => $achievement->tier_color_class,
                'tier_icon' => $achievement->tier_icon,
                'requirement_description' => $achievement->requirement_description,
            ]);
        });

        return response()->json([
            'success' => true,
            'data' => $achievementsWithProgress,
        ]);
    }

    /**
     * Get user's earned achievements
     */
    public function getUserAchievements(): JsonResponse
    {
        $user = Auth::user();

        $achievements = $user->userAchievements()
            ->with('achievement')
            ->orderBy('earned_at', 'desc')
            ->paginate(20);

        return response()->json([
            'success' => true,
            'data' => $achievements->items(),
            'pagination' => [
                'current_page' => $achievements->currentPage(),
                'total_pages' => $achievements->lastPage(),
                'total_items' => $achievements->total(),
            ],
        ]);
    }

    /**
     * Get today's daily challenge
     */
    public function getDailyChallenge(Request $request): JsonResponse
    {
        $user = Auth::user();
        $tier = $request->query('tier', $user->current_skill_tier);

        $challenge = DailyChallenge::getOrCreateToday('puzzle', $tier);
        $userCompletion = $challenge->getUserCompletion($user->id);

        if (!$userCompletion) {
            $userCompletion = $challenge->userCompletions()->create([
                'user_id' => $user->id,
                'completed' => false,
                'attempts' => 0,
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => array_merge($challenge->toArray(), [
                'user_completion' => $userCompletion,
                'challenge_type_display' => $challenge->challenge_type_display,
                'challenge_type_icon' => $challenge->challenge_type_icon,
                'tier_color_class' => $challenge->tier_color_class,
                'completion_count' => $challenge->completion_count,
                'success_rate' => $challenge->success_rate,
            ]),
        ]);
    }

    /**
     * Submit daily challenge solution
     */
    public function submitDailyChallenge(Request $request): JsonResponse
    {
        $request->validate([
            'solution' => 'required|array',
            'time_spent_seconds' => 'required|integer|min:0',
        ]);

        $user = Auth::user();
        $challenge = DailyChallenge::current()->firstOrFail();

        if ($challenge->isCompletedBy($user->id)) {
            return response()->json([
                'success' => false,
                'message' => 'You have already completed today\'s challenge.',
            ], 400);
        }

        $userCompletion = $challenge->getUserCompletion($user->id);
        $solution = $request->solution;

        // Validate solution (simplified for this example)
        $correctSolution = $challenge->puzzle_solution;
        $isCorrect = $solution === $correctSolution;

        $userCompletion->incrementAttempts();

        if ($isCorrect) {
            $userCompletion->markCompleted($request->time_spent_seconds);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'correct' => $isCorrect,
                'solution' => $correctSolution,
                'xp_awarded' => $isCorrect ? $challenge->xp_reward : 0,
                'user_completion' => $userCompletion->fresh(),
                'user_stats' => $user->fresh()->tutorial_stats,
            ],
        ]);
    }

    /**
     * Create practice game
     */
    public function createPracticeGame(Request $request): JsonResponse
    {
        $request->validate([
            'lesson_id' => 'nullable|exists:tutorial_lessons,id',
            'ai_difficulty' => ['required', Rule::in(['easy', 'medium', 'hard', 'expert'])],
        ]);

        $user = Auth::user();

        $game = TutorialPracticeGame::create([
            'user_id' => $user->id,
            'lesson_id' => $request->lesson_id,
            'ai_difficulty' => $request->ai_difficulty,
            'result' => 'playing', // Temporary state
            'played_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'data' => $game,
        ]);
    }

    /**
     * Complete practice game
     */
    public function completePracticeGame(Request $request, $id): JsonResponse
    {
        $request->validate([
            'result' => ['required', Rule::in(['win', 'loss', 'draw'])],
            'moves_played' => 'required|integer|min:0',
            'game_data' => 'nullable|array',
            'duration_seconds' => 'required|integer|min:0',
        ]);

        $user = Auth::user();
        $game = $user->tutorialPracticeGames()->findOrFail($id);

        // Calculate XP based on result and difficulty
        $xpAwarded = $this->calculatePracticeGameXp($game->ai_difficulty, $request->result);

        $game->update([
            'result' => $request->result,
            'moves_played' => $request->moves_played,
            'game_data' => $request->game_data,
            'duration_seconds' => $request->duration_seconds,
            'xp_earned' => $xpAwarded,
        ]);

        // Award XP
        $user->awardTutorialXp($xpAwarded, "Practice Game: {$request->result}");

        return response()->json([
            'success' => true,
            'data' => [
                'game' => $game->fresh(),
                'xp_awarded' => $xpAwarded,
                'user_stats' => $user->fresh()->tutorial_stats,
            ],
        ]);
    }

    /**
     * Create skill assessment
     */
    public function createSkillAssessment(Request $request): JsonResponse
    {
        $request->validate([
            'skill_tier' => ['required', Rule::in(['beginner', 'intermediate', 'advanced'])],
            'assessment_type' => ['required', Rule::in(['initial', 'module_completion', 'challenge'])],
            'score' => 'required|numeric|min:0|max:100',
            'rating_before' => 'nullable|integer|min:0',
            'rating_after' => 'nullable|integer|min:0',
            'assessment_data' => 'nullable|array',
        ]);

        $user = Auth::user();

        $assessment = $user->skillAssessments()->create([
            'skill_tier' => $request->skill_tier,
            'assessment_type' => $request->assessment_type,
            'score' => $request->score,
            'rating_before' => $request->rating_before,
            'rating_after' => $request->rating_after,
            'assessment_data' => $request->assessment_data,
        ]);

        // Update user's skill tier if passed
        if ($assessment->isPassed()) {
            $user->updateSkillTier();
        }

        return response()->json([
            'success' => true,
            'data' => array_merge($assessment->toArray(), [
                'assessment_type_display' => $assessment->assessment_type_display,
                'skill_tier_display' => $assessment->skill_tier_display,
                'grade' => $assessment->grade,
                'grade_color_class' => $assessment->grade_color_class,
                'rating_change' => $assessment->rating_change,
                'formatted_rating_change' => $assessment->formatted_rating_change,
                'rating_change_color_class' => $assessment->rating_change_color_class,
            ]),
        ]);
    }

    /**
     * Get next lesson for user to continue
     */
    private function getNextLesson($user): ?array
    {
        // Find the first incomplete lesson
        $lesson = TutorialLesson::active()
            ->whereHas('module', function ($query) {
                $query->active();
            })
            ->where(function ($query) use ($user) {
                $query->whereDoesntHave('userProgress', function ($q) use ($user) {
                    $q->where('user_id', $user->id);
                })
                ->orWhereHas('userProgress', function ($q) use ($user) {
                    $q->where('user_id', $user->id)
                      ->where('status', '!=', 'completed');
                });
            })
            ->orderBy('sort_order')
            ->first();

        if (!$lesson) {
            return null;
        }

        return [
            'id' => $lesson->id,
            'title' => $lesson->title,
            'module_name' => $lesson->module->name,
            'lesson_type' => $lesson->lesson_type,
            'is_unlocked' => $lesson->isUnlockedFor($user->id),
        ];
    }

    /**
     * Calculate XP for practice games
     */
    private function calculatePracticeGameXp($difficulty, $result): int
    {
        $baseXp = match($difficulty) {
            'easy' => 10,
            'medium' => 20,
            'hard' => 30,
            'expert' => 50,
            default => 10,
        };

        $multiplier = match($result) {
            'win' => 1.0,
            'draw' => 0.5,
            'loss' => 0.2,
            default => 0,
        };

        return (int) ($baseXp * $multiplier);
    }
}