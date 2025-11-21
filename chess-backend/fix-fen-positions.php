<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== FIXING INVALID FEN POSITIONS ===\n\n";

// Get the Chess Basics lessons
$lessons = \App\Models\TutorialLesson::whereIn('title', [
    'The Chessboard',
    'How the King Moves',
    'Pawn Movement Basics'
])->get();

foreach ($lessons as $lesson) {
    echo "Processing: {$lesson->title} (ID: {$lesson->id})\n";

    $contentData = $lesson->content_data;
    $originalData = $contentData;
    $needsUpdate = false;

    switch ($lesson->title) {
        case 'The Chessboard':
            // This lesson looks fine - it has valid starting position
            break;

        case 'How the King Moves':
            // Fix the king position examples
            if (isset($contentData['slides'])) {
                foreach ($contentData['slides'] as &$slide) {
                    if (isset($slide['diagram'])) {
                        // Replace invalid position with a valid king position
                        if ($slide['diagram'] === '8/8/8/8/3K4/8/8/8 w - - 0 1') {
                            $slide['diagram'] = '8/8/8/8/3K4/8/8/k7 w - - 0 1'; // Add black king
                            $needsUpdate = true;
                            echo "  ✅ Fixed king position with black king\n";
                        }
                    }
                }
            }
            break;

        case 'Pawn Movement Basics':
            // Fix the puzzle FEN positions - they need both kings
            if (isset($contentData['puzzles'])) {
                foreach ($contentData['puzzles'] as &$puzzle) {
                    if (isset($puzzle['fen'])) {
                        $originalFen = $puzzle['fen'];

                        // Fix single pawn position
                        if ($originalFen === '8/8/8/8/8/8/P7/8 w - - 0 1') {
                            $puzzle['fen'] = 'k7/8/8/8/8/8/P7/K7 w - - 0 1'; // Add kings
                            $needsUpdate = true;
                            echo "  ✅ Fixed pawn puzzle with kings\n";
                        }

                        // Fix starting position puzzle
                        if ($originalFen === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
                            // This one is actually valid (standard starting position)
                            echo "  ✅ Starting position is valid\n";
                        }
                    }
                }
            }
            break;
    }

    // Save the updated content if changed
    if ($needsUpdate) {
        $lesson->content_data = $contentData;
        $lesson->save();
        echo "  💾 Updated lesson content\n";
    } else {
        echo "  ℹ️  No changes needed\n";
    }

    echo "\n";
}

echo "=== VERIFICATION ===\n";

// Verify the fixes
$lessons = \App\Models\TutorialLesson::whereIn('title', [
    'The Chessboard',
    'How the King Moves',
    'Pawn Movement Basics'
])->get();

foreach ($lessons as $lesson) {
    echo "Checking: {$lesson->title}\n";

    $contentData = $lesson->content_data;

    if ($lesson->lesson_type === 'theory' && isset($contentData['slides'])) {
        foreach ($contentData['slides'] as $i => $slide) {
            if (isset($slide['diagram'])) {
                try {
                    $chess = new \Chess\Chess($slide['diagram']);
                    echo "  ✅ Slide " . ($i + 1) . " FEN is valid\n";
                } catch (Exception $e) {
                    echo "  ❌ Slide " . ($i + 1) . " FEN is still invalid: " . $e->getMessage() . "\n";
                    echo "     FEN: " . $slide['diagram'] . "\n";
                }
            }
        }
    }

    if ($lesson->lesson_type === 'puzzle' && isset($contentData['puzzles'])) {
        foreach ($contentData['puzzles'] as $i => $puzzle) {
            if (isset($puzzle['fen'])) {
                try {
                    $chess = new \Chess\Chess($puzzle['fen']);
                    echo "  ✅ Puzzle " . ($i + 1) . " FEN is valid\n";
                } catch (Exception $e) {
                    echo "  ❌ Puzzle " . ($i + 1) . " FEN is still invalid: " . $e->getMessage() . "\n";
                    echo "     FEN: " . $puzzle['fen'] . "\n";
                }
            }
        }
    }

    echo "\n";
}

echo "✅ FEN position fixes complete!\n";