<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

// Check Chess Basics lessons
$lessons = App\Models\TutorialLesson::whereIn('title', ['The Chessboard', 'How the King Moves', 'Pawn Movement Basics'])->get();

echo "=== Chess Basics Lessons ===\n";
foreach ($lessons as $lesson) {
    echo "ID: {$lesson->id}\n";
    echo "Title: {$lesson->title}\n";
    echo "Unlock Requirement: " . ($lesson->unlock_requirement_lesson_id ?? 'None') . "\n";
    echo "Active: " . ($lesson->is_active ? 'Yes' : 'No') . "\n";
    echo "Module ID: {$lesson->module_id}\n";
    echo "Sort Order: {$lesson->sort_order}\n";
    echo "---\n";
}

// Check if there are any other lessons that might be requirements
echo "\n=== All Active Lessons ===\n";
$allLessons = App\Models\TutorialLesson::where('is_active', true)->orderBy('module_id')->orderBy('sort_order')->get();

foreach ($allLessons as $lesson) {
    echo "Module {$lesson->module_id}: {$lesson->title} (ID: {$lesson->id})";
    if ($lesson->unlock_requirement_lesson_id) {
        echo " -> Requires Lesson ID {$lesson->unlock_requirement_lesson_id}";
    }
    echo "\n";
}

// Check modules
echo "\n=== Modules ===\n";
$modules = App\Models\TutorialModule::all();
foreach ($modules as $module) {
    echo "Module {$module->id}: {$module->name} (Slug: {$module->slug})\n";
    echo "  Unlock Requirement: " . ($module->unlock_requirement_id ?? 'None') . "\n";
    echo "---\n";
}