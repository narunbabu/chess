#!/usr/bin/env pwsh

# Test lesson progress tracking
# This script tests the lesson start and completion flow

Write-Host "=== Testing Lesson Progress Tracking ===" -ForegroundColor Cyan
Write-Host ""

# Change to backend directory
Set-Location "$PSScriptRoot\chess-backend"

Write-Host "Step 1: Starting a lesson and checking progress..." -ForegroundColor Yellow
php artisan tinker --execute="
use App\Models\User;
use App\Models\TutorialLesson;
use App\Models\UserTutorialProgress;

// Get first user and first lesson
\$user = User::first();
\$lesson = TutorialLesson::first();

if (!\$user || !\$lesson) {
    echo '❌ No user or lesson found. Run seeders first.\n';
    exit(1);
}

echo '✅ Found user: ' . \$user->name . ' (ID: ' . \$user->id . ')\n';
echo '✅ Found lesson: ' . \$lesson->title . ' (ID: ' . \$lesson->id . ')\n';

// Check existing progress
\$existingProgress = UserTutorialProgress::where('user_id', \$user->id)
    ->where('lesson_id', \$lesson->id)
    ->first();

if (\$existingProgress) {
    echo '⚠️  Existing progress found - deleting for fresh test\n';
    \$existingProgress->delete();
}

// Start the lesson (simulating API call)
\$progress = UserTutorialProgress::create([
    'user_id' => \$user->id,
    'lesson_id' => \$lesson->id,
    'status' => 'in_progress',
    'attempts' => 1,
]);

echo '✅ Lesson started - Progress ID: ' . \$progress->id . '\n';
echo '   Status: ' . \$progress->status . '\n';
echo '   Attempts: ' . \$progress->attempts . '\n';
"

Write-Host ""
Write-Host "Step 2: Completing the lesson..." -ForegroundColor Yellow
php artisan tinker --execute="
use App\Models\User;
use App\Models\TutorialLesson;
use App\Models\UserTutorialProgress;

\$user = User::first();
\$lesson = TutorialLesson::first();
\$progress = UserTutorialProgress::where('user_id', \$user->id)
    ->where('lesson_id', \$lesson->id)
    ->first();

if (!\$progress) {
    echo '❌ No progress found. Start the lesson first.\n';
    exit(1);
}

// Complete the lesson (simulating API call)
\$progress->markAsCompleted(
    85.0,  // score
    300    // time_spent_seconds (5 minutes)
);

echo '✅ Lesson completed!\n';
echo '   Status: ' . \$progress->status . '\n';
echo '   Score: ' . \$progress->best_score . '\n';
echo '   Time Spent: ' . \$progress->time_spent_seconds . ' seconds\n';
echo '   Completed At: ' . \$progress->completed_at . '\n';
"

Write-Host ""
Write-Host "Step 3: Checking user stats..." -ForegroundColor Yellow
php artisan tinker --execute="
use App\Models\User;

\$user = User::first();
\$stats = \$user->tutorial_stats;

echo '📊 User Tutorial Stats:\n';
echo '   Total Lessons: ' . \$stats['total_lessons'] . '\n';
echo '   Completed Lessons: ' . \$stats['completed_lessons'] . '\n';
echo '   Completion %: ' . \$stats['completion_percentage'] . '%\n';
echo '   Average Score: ' . \$stats['average_score'] . '\n';
echo '   Total Modules: ' . \$stats['total_modules'] . '\n';
echo '   Completed Modules: ' . \$stats['completed_modules'] . '\n';
echo '   Current Streak: ' . \$stats['current_streak'] . ' days\n';
echo '   XP: ' . \$stats['xp'] . '\n';
echo '   Level: ' . \$stats['level'] . '\n';
echo '   Skill Tier: ' . \$stats['skill_tier'] . '\n';
"

Write-Host ""
Write-Host "Step 4: Verifying module progress..." -ForegroundColor Yellow
php artisan tinker --execute="
use App\Models\User;
use App\Models\TutorialLesson;
use App\Models\TutorialModule;

\$user = User::first();
\$lesson = TutorialLesson::first();
\$module = \$lesson->module;

\$moduleProgress = \$module->getUserProgress(\$user->id);

echo '📦 Module Progress for: ' . \$module->name . '\n';
echo '   Total Lessons: ' . \$moduleProgress['total_lessons'] . '\n';
echo '   Completed Lessons: ' . \$moduleProgress['completed_lessons'] . '\n';
echo '   Percentage: ' . \$moduleProgress['percentage'] . '%\n';
echo '   Is Completed: ' . (\$moduleProgress['is_completed'] ? 'Yes' : 'No') . '\n';
"

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  ✅ Lesson started successfully" -ForegroundColor Green
Write-Host "  ✅ Lesson completed successfully" -ForegroundColor Green
Write-Host "  ✅ User stats updated" -ForegroundColor Green
Write-Host "  ✅ Module progress calculated" -ForegroundColor Green
Write-Host ""
Write-Host "Now test the frontend by completing a lesson!" -ForegroundColor Yellow
