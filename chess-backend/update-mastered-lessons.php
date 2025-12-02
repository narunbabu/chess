<?php
/**
 * Update existing high-score lessons to 'mastered' status
 * This script marks all lessons with score >= 90 as mastered
 */

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\UserTutorialProgress;
use Illuminate\Support\Facades\DB;

echo "🔍 Finding lessons with score >= 90 that should be mastered...\n\n";

// Find all completed lessons with high scores
$highScoreLessons = UserTutorialProgress::where('status', 'completed')
    ->where('best_score', '>=', 90)
    ->get();

echo "Found " . $highScoreLessons->count() . " lessons to update\n\n";

if ($highScoreLessons->isEmpty()) {
    echo "✅ No lessons need to be updated to mastered status\n";
    exit(0);
}

foreach ($highScoreLessons as $progress) {
    echo "📚 Lesson ID: {$progress->lesson_id}\n";
    echo "   User ID: {$progress->user_id}\n";
    echo "   Score: {$progress->best_score}\n";
    echo "   Current Status: {$progress->status}\n";

    try {
        // Mark as mastered
        $progress->markAsMastered();
        echo "   ✅ Updated to 'mastered' status\n";
        echo "   🏆 Bonus XP awarded\n";
    } catch (Exception $e) {
        echo "   ❌ Error: " . $e->getMessage() . "\n";
    }

    echo "\n";
}

// Show summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
echo "📊 SUMMARY\n";
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

$masteredCount = UserTutorialProgress::where('status', 'mastered')->count();
$completedCount = UserTutorialProgress::where('status', 'completed')->count();

echo "✅ Mastered lessons: {$masteredCount}\n";
echo "📝 Completed lessons: {$completedCount}\n";

echo "\n✨ Update complete!\n";
