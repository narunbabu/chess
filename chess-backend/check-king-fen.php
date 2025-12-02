<?php

require_once 'vendor/autoload.php';

$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\TutorialLesson;
use App\Models\InteractiveLessonStage;

$lesson = TutorialLesson::where('slug', 'king-movement')->first();
if (!$lesson) {
    echo "King lesson not found.\n";
    exit(1);
}

echo "King Lesson ID: " . $lesson->id . "\n";

$stages = InteractiveLessonStage::where('lesson_id', $lesson->id)->orderBy('stage_order')->get();

echo "King Lesson Stages FEN:\n";
foreach($stages as $stage) {
    echo "Stage {$stage->stage_order}: " . $stage->initial_fen . "\n";
}

?>
