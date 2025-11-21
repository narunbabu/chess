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

echo "Testing API response for user: {$user->name} (ID: {$user->id})\n";
echo "==========================================================\n\n";

// Get modules like the API would
$modules = \App\Models\TutorialModule::active()
    ->with(['activeLessons' => function ($query) use ($user) {
        $query->with(['userProgress' => function ($query) use ($user) {
            $query->where('user_id', $user->id);
        }]);
    }])
    ->with(['unlockRequirement'])
    ->orderBy('skill_tier')
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
    $moduleData['lessons'] = $lessonsWithProgress->toArray();
    $moduleData['user_progress'] = $progress;
    $moduleData['is_unlocked'] = $isUnlocked;
    $moduleData['total_xp'] = $module->total_xp;
    $moduleData['formatted_duration'] = $module->formatted_duration;

    return $moduleData;
});

foreach ($modulesWithProgress as $module) {
    echo "Module: {$module['name']} (ID: {$module['id']})\n";
    echo "  Slug: {$module['slug']}\n";
    echo "  Unlocked: " . ($module['is_unlocked'] ? 'YES' : 'NO') . "\n";
    echo "  Progress: {$module['user_progress']['completed_lessons']}/{$module['user_progress']['total_lessons']} ({$module['user_progress']['percentage']}%)\n";

    echo "  Lessons:\n";
    foreach ($module['lessons'] as $lesson) {
        $status = $lesson['user_progress']['status'] ?? 'not_started';
        echo "    - {$lesson['title']} (ID: {$lesson['id']})\n";
        echo "      Unlocked: " . ($lesson['is_unlocked'] ? 'YES' : 'NO') . "\n";
        echo "      Status: {$status}\n";
        echo "      Has Progress: " . ($lesson['user_progress'] ? 'YES' : 'NO') . "\n";
    }
    echo "\n";
}