<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== REAL API SIMULATION ===\n\n";

// Get a test user
$user = \App\Models\User::first();
if (!$user) {
    echo "❌ No users found\n";
    exit;
}

echo "Simulating API call to: /api/tutorial/modules/chess-basics\n";
echo "User: {$user->name} (ID: {$user->id})\n";
echo "========================================================\n\n";

// Simulate the exact API call that the frontend makes
try {
    // This mimics the TutorialController::getModule method
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
    $moduleData['lessons'] = $lessonsWithProgress; // Fixed key
    $moduleData['user_progress'] = $module->getUserProgress($user->id);
    $moduleData['is_unlocked'] = $module->isUnlockedFor($user->id);

    // Simulate the JSON response
    $apiResponse = [
        'success' => true,
        'data' => $moduleData,
    ];

    echo "✅ API Response Structure:\n";
    echo json_encode($apiResponse, JSON_PRETTY_PRINT) . "\n\n";

    echo "=== FRONTEND COMPATIBILITY CHECK ===\n";
    echo "Module Name: {$apiResponse['data']['name']}\n";
    echo "Module Unlocked: " . ($apiResponse['data']['is_unlocked'] ? 'YES' : 'NO') . "\n";
    echo "Lessons Count: " . count($apiResponse['data']['lessons']) . "\n\n";

    foreach ($apiResponse['data']['lessons'] as $index => $lesson) {
        echo "Lesson " . ($index + 1) . ": {$lesson['title']}\n";
        echo "  is_unlocked: " . ($lesson['is_unlocked'] ? 'YES' : 'NO') . "\n";
        echo "  frontend calculates isLocked: " . (!$lesson['is_unlocked'] ? 'YES' : 'NO') . "\n";
        echo "  user_progress: " . json_encode($lesson['user_progress']) . "\n\n";
    }

} catch (Exception $e) {
    echo "❌ API Error: " . $e->getMessage() . "\n";
    echo "Stack trace: " . $e->getTraceAsString() . "\n";
}