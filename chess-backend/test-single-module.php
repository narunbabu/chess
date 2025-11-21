<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

// Create a test user or get existing user
$user = \App\Models\User::first();

if (!$user) {
    echo "No users found in database\n";
    exit;
}

echo "Testing single module API response for Chess Basics\n";
echo "====================================================\n\n";

// Get single module like the API would
$module = \App\Models\TutorialModule::active()
    ->with(['activeLessons' => function ($query) use ($user) {
        $query->with(['userProgress' => function ($query) use ($user) {
            $query->where('user_id', $user->id);
        }]);
    }])
    ->with(['unlockRequirement'])
    ->where('slug', 'chess-basics')
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

echo "Module: {$moduleData['name']} (ID: {$moduleData['id']})\n";
echo "  Slug: {$moduleData['slug']}\n";
echo "  Unlocked: " . ($moduleData['is_unlocked'] ? 'YES' : 'NO') . "\n";
echo "  Progress: {$moduleData['user_progress']['completed_lessons']}/{$moduleData['user_progress']['total_lessons']} ({$moduleData['user_progress']['percentage']}%)\n";

echo "  Lessons (using 'lessons' key):\n";
foreach ($moduleData['lessons'] as $lesson) {
    $status = $lesson['user_progress']['status'] ?? 'not_started';
    echo "    - {$lesson['title']} (ID: {$lesson['id']})\n";
    echo "      Unlocked: " . ($lesson['is_unlocked'] ? 'YES' : 'NO') . "\n";
    echo "      Status: {$status}\n";
}

echo "\n  Lessons (using 'activeLessons' key - original):\n";
if (isset($moduleData['activeLessons'])) {
    foreach ($moduleData['activeLessons'] as $lesson) {
        $status = $lesson['user_progress']['status'] ?? 'not_started';
        echo "    - {$lesson['title']} (ID: {$lesson['id']})\n";
        echo "      Unlocked: " . ($lesson['is_unlocked'] ? 'YES' : 'NO') . "\n";
        echo "      Status: {$status}\n";
    }
} else {
    echo "    No 'activeLessons' key found\n";
}

echo "\nFrontend expects 'lessons' key count: " . count($moduleData['lessons']) . "\n";