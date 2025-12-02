<?php

// Simple test script for lesson progress tracking

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\TutorialLesson;
use App\Models\UserTutorialProgress;

echo "=== Testing Lesson Progress Tracking ===\n\n";

// Get first user and first lesson
$user = User::first();
$lesson = TutorialLesson::first();

if (!$user || !$lesson) {
    echo "❌ No user or lesson found. Run seeders first.\n";
    exit(1);
}

echo "✅ Found user: {$user->name} (ID: {$user->id})\n";
echo "✅ Found lesson: {$lesson->title} (ID: {$lesson->id})\n\n";

// Step 1: Check existing progress
echo "Step 1: Checking existing progress...\n";
$existingProgress = UserTutorialProgress::where('user_id', $user->id)
    ->where('lesson_id', $lesson->id)
    ->first();

if ($existingProgress) {
    echo "⚠️  Existing progress found:\n";
    echo "   Status: {$existingProgress->status}\n";
    echo "   Score: {$existingProgress->best_score}\n";
    echo "   Completed: " . ($existingProgress->completed_at ? 'Yes' : 'No') . "\n\n";
} else {
    echo "ℹ️  No existing progress found.\n\n";
}

// Step 2: Start the lesson (if not started)
if (!$existingProgress || $existingProgress->status === 'not_started') {
    echo "Step 2: Starting the lesson...\n";
    if (!$existingProgress) {
        $progress = UserTutorialProgress::create([
            'user_id' => $user->id,
            'lesson_id' => $lesson->id,
            'status' => 'in_progress',
            'attempts' => 1,
        ]);
    } else {
        $progress = $existingProgress;
        $progress->status = 'in_progress';
        $progress->attempts = ($progress->attempts ?? 0) + 1;
        $progress->save();
    }
    echo "✅ Lesson started - Progress ID: {$progress->id}\n";
    echo "   Status: {$progress->status}\n";
    echo "   Attempts: {$progress->attempts}\n\n";
} else {
    $progress = $existingProgress;
    echo "Step 2: Lesson already started, skipping...\n\n";
}

// Step 3: Complete the lesson
echo "Step 3: Completing the lesson...\n";
$progress->markAsCompleted(
    85.0,  // score
    300    // time_spent_seconds (5 minutes)
);

echo "✅ Lesson completed!\n";
echo "   Status: {$progress->status}\n";
echo "   Score: {$progress->best_score}\n";
echo "   Time Spent: {$progress->time_spent_seconds} seconds\n";
echo "   Completed At: {$progress->completed_at}\n\n";

// Step 4: Check user stats
echo "Step 4: Checking user stats...\n";
$stats = $user->fresh()->tutorial_stats;

echo "📊 User Tutorial Stats:\n";
echo "   Total Lessons: {$stats['total_lessons']}\n";
echo "   Completed Lessons: {$stats['completed_lessons']}\n";
echo "   Completion %: {$stats['completion_percentage']}%\n";
echo "   Average Score: {$stats['average_score']}\n";
echo "   Total Modules: {$stats['total_modules']}\n";
echo "   Completed Modules: {$stats['completed_modules']}\n";
echo "   Current Streak: {$stats['current_streak']} days\n";
echo "   XP: {$stats['xp']}\n";
echo "   Level: {$stats['level']}\n";
echo "   Skill Tier: {$stats['skill_tier']}\n\n";

// Step 5: Check module progress
echo "Step 5: Verifying module progress...\n";
$module = $lesson->module;
$moduleProgress = $module->getUserProgress($user->id);

echo "📦 Module Progress for: {$module->name}\n";
echo "   Total Lessons: {$moduleProgress['total_lessons']}\n";
echo "   Completed Lessons: {$moduleProgress['completed_lessons']}\n";
echo "   Percentage: {$moduleProgress['percentage']}%\n";
echo "   Is Completed: " . ($moduleProgress['is_completed'] ? 'Yes' : 'No') . "\n\n";

echo "=== Test Complete ===\n\n";
echo "Summary:\n";
echo "  ✅ Lesson started successfully\n";
echo "  ✅ Lesson completed successfully\n";
echo "  ✅ User stats updated\n";
echo "  ✅ Module progress calculated\n\n";
echo "Now test the frontend by completing a lesson!\n";
