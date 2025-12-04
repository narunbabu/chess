<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipStanding;

echo "=== Tournament Cleanup Tool ===\n";

if ($argc < 2) {
    echo "Usage: php cleanup_corrupted_tournament.php <championship_id> [--confirm]\n";
    echo "  <championship_id>  ID of the tournament to clean up\n";
    echo "  --confirm        Actually perform the deletion (without this, it's dry-run)\n";
    echo "\nExample: php cleanup_corrupted_tournament.php 37 --confirm\n";
    exit(1);
}

$championshipId = (int)$argv[1];
$confirm = in_array('--confirm', $argv);

// Get championship
$championship = Championship::find($championshipId);
if (!$championship) {
    echo "❌ Championship {$championshipId} not found!\n";
    exit(1);
}

echo "🏆 Championship found: " . ($championship->name ?? "ID {$championshipId}") . "\n";
echo "   Status: {$championship->status}\n";
echo "   Participants: " . $championship->participants()->count() . "\n";

// Check existing data
$matchesCount = $championship->matches()->count();
$standingsCount = $championship->standings()->count();

echo "\n📊 Current Data:\n";
echo "   Matches: {$matchesCount}\n";
echo "   Standings: {$standingsCount}\n";

// Show problematic data if any
$duplicateMatches = $championship->matches()
    ->select('player1_id', 'player2_id', 'round_number')
    ->selectRaw('COUNT(*) as count')
    ->groupBy('player1_id', 'player2_id', 'round_number')
    ->having('count', '>', 1)
    ->get();

if ($duplicateMatches->isNotEmpty()) {
    echo "\n⚠️  Found duplicate matches:\n";
    foreach ($duplicateMatches as $dup) {
        echo "   Round {$dup->round_number}: Player {$dup->player1_id} vs " . ($dup->player2_id ?? 'BYE') . " ({$dup->count} duplicates)\n";
    }
}

$byeMatches = $championship->matches()
    ->whereNull('player2_id')
    ->where('result_type_id', '!=', 6) // Not marked as BYE result type
    ->get();

if ($byeMatches->isNotEmpty()) {
    echo "\n⚠️  Found unmarked Bye matches:\n";
    foreach ($byeMatches as $match) {
        echo "   Match {$match->id}: Round {$match->round_number}, Player {$match->player1_id} vs BYE (Result Type: {$match->result_type_id})\n";
    }
}

if (!$confirm) {
    echo "\n🔍 DRY RUN MODE - No changes will be made.\n";
    echo "   Use --confirm flag to actually perform cleanup.\n";
    echo "\nCleanup actions that would be performed:\n";
    echo "   1. Delete all matches for Championship {$championshipId}\n";
    echo "   2. Delete all standings for Championship {$championshipId}\n";
    echo "   3. Reset championship status to 'setup' (if needed)\n";
} else {
    echo "\n🗑️  PERFORMING CLEANUP...\n";

    try {
        // Delete matches
        $championship->matches()->delete();
        echo "   ✅ Deleted all matches ({$matchesCount} records)\n";

        // Delete standings
        $championship->standings()->delete();
        echo "   ✅ Deleted all standings ({$standingsCount} records)\n";

        // Optional: Reset status to setup if tournament was corrupted
        if (in_array($championship->status, ['active', 'completed'])) {
            $championship->update(['status' => 'setup']);
            echo "   ✅ Reset championship status to 'setup'\n";
        }

        echo "\n🎉 Cleanup completed successfully!\n";
        echo "   Championship {$championshipId} is now ready for fresh tournament generation.\n";

    } catch (\Exception $e) {
        echo "\n❌ Cleanup failed: " . $e->getMessage() . "\n";
        exit(1);
    }
}

echo "\nDone!\n";