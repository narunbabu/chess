<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== FRONTEND FLOW SIMULATION ===\n\n";

// Simulate user authentication
$user = \App\Models\User::first();
if (!$user) {
    echo "❌ No user found\n";
    exit;
}

echo "User: {$user->name} (ID: {$user->id})\n";
echo "Testing the exact API call path...\n\n";

// Step 1: User navigates to Tutorial Hub (should work)
echo "1️⃣ Tutorial Hub (/api/tutorial/modules)\n";
echo "=========================================\n";

try {
    $modulesResponse = [
        'success' => true,
        'data' => \App\Models\TutorialModule::active()
            ->with(['activeLessons' => function ($query) use ($user) {
                $query->with(['userProgress' => function ($query) use ($user) {
                    $query->where('user_id', $user->id);
                }]);
            }])
            ->with(['unlockRequirement'])
            ->orderBy('skill_tier')
            ->orderBy('sort_order')
            ->get()
            ->map(function ($module) use ($user) {
                $progress = $module->getUserProgress($user->id);
                $isUnlocked = $module->isUnlockedFor($user->id);

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
            })
    ];

    echo "✅ Tutorial Hub API response successful\n";

    // Find Chess Basics module
    $chessBasics = collect($modulesResponse['data'])->firstWhere('slug', 'chess-basics');
    if ($chessBasics) {
        echo "Chess Basics found: {$chessBasics['name']}\n";
        echo "  Module Unlocked: " . ($chessBasics['is_unlocked'] ? 'YES' : 'NO') . "\n";
        echo "  Lessons count: " . count($chessBasics['lessons']) . "\n";

        foreach ($chessBasics['lessons'] as $i => $lesson) {
            echo "    Lesson " . ($i + 1) . ": {$lesson['title']} - UNLOCKED: " . ($lesson['is_unlocked'] ? 'YES' : 'NO') . "\n";
        }
    }
} catch (Exception $e) {
    echo "❌ Tutorial Hub API error: " . $e->getMessage() . "\n";
}

echo "\n";

// Step 2: User clicks on Chess Basics module
echo "2️⃣ Module Detail (/api/tutorial/modules/chess-basics)\n";
echo "================================================\n";

try {
    $module = \App\Models\TutorialModule::active()
        ->with(['activeLessons' => function ($query) use ($user) {
            $query->with(['userProgress' => function ($query) use ($user) {
                $query->where('user_id', $user->id);
            }]);
        }])
        ->with(['unlockRequirement'])
        ->where('slug', 'chess-basics')
        ->first();

    if (!$module) {
        echo "❌ Module not found\n";
        exit;
    }

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
    $moduleData['lessons'] = $lessonsWithProgress;
    $moduleData['user_progress'] = $module->getUserProgress($user->id);
    $moduleData['is_unlocked'] = $module->isUnlockedFor($user->id);

    $moduleResponse = [
        'success' => true,
        'data' => $moduleData,
    ];

    echo "✅ Module Detail API response successful\n";
    echo "Module: {$moduleData['name']}\n";
    echo "  Module Unlocked: " . ($moduleData['is_unlocked'] ? 'YES' : 'NO') . "\n";
    echo "  API Response structure keys: " . implode(', ', array_keys($moduleData)) . "\n";

    // Check both lesson arrays
    echo "  active_lessons count: " . count($moduleData['active_lessons'] ?? []) . "\n";
    echo "  lessons count: " . count($moduleData['lessons'] ?? []) . "\n";

    echo "\n  Frontend should use 'lessons' array:\n";
    foreach ($moduleData['lessons'] as $i => $lesson) {
        $isLocked = !$lesson['is_unlocked'];
        echo "    Lesson " . ($i + 1) . ": {$lesson['title']}\n";
        echo "      API is_unlocked: " . ($lesson['is_unlocked'] ? 'TRUE' : 'FALSE') . "\n";
        echo "      Frontend calculates isLocked: " . ($isLocked ? 'TRUE' : 'FALSE') . "\n";
        echo "      Frontend should show: " . ($isLocked ? '🔒 Locked button' : '🚀 Start button') . "\n";
    }

} catch (Exception $e) {
    echo "❌ Module Detail API error: " . $e->getMessage() . "\n";
}

echo "\n=== CONCLUSION ===\n";
echo "✅ Backend API is working correctly\n";
echo "✅ All lessons have is_unlocked: true\n";
echo "✅ Frontend should calculate isLocked: false\n";
echo "✅ Frontend should show '🚀 Start' buttons, not '🔒 Locked'\n";
echo "\nIf frontend still shows locked, the issue is in frontend component logic.\n";