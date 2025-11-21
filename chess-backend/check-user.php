<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

// Get user
$user = App\Models\User::find(2);

if (!$user) {
    echo "User not found!\n";
    exit(1);
}

echo "=== User Info ===\n";
echo "ID: {$user->id}\n";
echo "Name: {$user->name}\n";
echo "Email: {$user->email}\n";
echo "\n=== Tutorial Fields ===\n";
echo "Tutorial XP: {$user->tutorial_xp}\n";
echo "Tutorial Level: {$user->tutorial_level}\n";
echo "Skill Tier: {$user->current_skill_tier}\n";
echo "Current Streak: {$user->current_streak_days} days\n";
echo "Longest Streak: {$user->longest_streak_days} days\n";
echo "Last Activity Date: {$user->last_activity_date}\n";

echo "\n=== Checking Lesson Progress ===\n";
$progress = App\Models\UserTutorialProgress::where('user_id', 2)
    ->where('lesson_id', 1)
    ->first();

if ($progress) {
    echo "Progress found!\n";
    echo "Status: {$progress->status}\n";
    echo "Best Score: {$progress->best_score}\n";
    echo "Time Spent: {$progress->time_spent_seconds}s\n";
    echo "Attempts: {$progress->attempts}\n";
} else {
    echo "No progress found for lesson 1\n";
}

echo "\n=== Testing Complete Lesson ===\n";
try {
    if (!$progress) {
        echo "Creating progress first...\n";
        $lesson = App\Models\TutorialLesson::find(1);
        $progress = $lesson->startLesson($user->id);
    }

    echo "Calling markAsCompleted...\n";
    $progress->markAsCompleted(100, 60);

    echo "Success! Lesson completed.\n";
    echo "New XP: " . $user->fresh()->tutorial_xp . "\n";

} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . ":" . $e->getLine() . "\n";
    echo "\nStack Trace:\n" . $e->getTraceAsString() . "\n";
}
