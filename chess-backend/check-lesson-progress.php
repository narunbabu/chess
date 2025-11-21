<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$userId = 2;
$user = App\Models\User::find($userId);
$module = App\Models\TutorialModule::where('slug', 'chess-basics')->first();

echo "Module: {$module->name}\n";
echo "User: {$user->name} (ID: {$userId})\n\n";

$lessons = $module->lessons()->with(['userProgress' => function($q) use ($user) {
    $q->where('user_id', $user->id);
}])->get();

foreach ($lessons as $lesson) {
    $progress = $lesson->userProgress->first();
    $status = $progress ? $progress->status : 'not_started';
    echo "Lesson ID: {$lesson->id} | Title: {$lesson->title} | Status: {$status}\n";
}

$completedCount = $lessons->filter(function($lesson) {
    $progress = $lesson->userProgress->first();
    return $progress && in_array($progress->status, ['completed', 'mastered']);
})->count();

echo "\nCompleted Lessons: {$completedCount} / {$lessons->count()}\n";
