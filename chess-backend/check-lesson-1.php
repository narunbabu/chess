<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$lesson = App\Models\TutorialLesson::find(1);

echo "Lesson: {$lesson->title}\n";
echo "Type: {$lesson->lesson_type}\n";
echo "Total Slides: " . count($lesson->content_data['slides'] ?? []) . "\n\n";

if (isset($lesson->content_data['slides'])) {
    foreach ($lesson->content_data['slides'] as $index => $slide) {
        echo "Slide " . ($index + 1) . ":\n";
        echo "  Title: " . ($slide['title'] ?? 'N/A') . "\n";
        echo "  Has Quiz: " . (isset($slide['quiz']) ? 'Yes (' . count($slide['quiz']) . ' questions)' : 'No') . "\n";
        echo "  Has Diagram: " . (isset($slide['diagram']) ? 'Yes' : 'No') . "\n";
        echo "\n";
    }
}
