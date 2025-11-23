<?php

require_once __DIR__ . '/vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Championship;
use App\Models\ChampionshipMatch;

echo "🔍 Checking Round Status for Championship 14\n";
echo str_repeat("=", 50) . "\n";

$championship = Championship::find(14);
if (!$championship) {
    echo "❌ Championship 14 not found\n";
    exit;
}

echo "✅ Championship: {$championship->title}\n";
echo "   - Format: {$championship->format}\n";
echo "   - Status: {$championship->status}\n";
echo "   - Swiss Rounds: {$championship->swiss_rounds}\n\n";

// Check round completion status
function checkRoundStatus($championship, $roundNumber) {
    echo "📊 Round {$roundNumber} Status:\n";

    $totalMatches = $championship->matches()
        ->where('round_number', $roundNumber)
        ->count();

    $completedMatches = $championship->matches()
        ->where('round_number', $roundNumber)
        ->where('status', 'completed')
        ->count();

    $pendingMatches = $championship->matches()
        ->where('round_number', $roundNumber)
        ->where('status', 'pending')
        ->count();

    echo "   - Total matches: {$totalMatches}\n";
    echo "   - Completed matches: {$completedMatches}\n";
    echo "   - Pending matches: {$pendingMatches}\n";
    echo "   - Round complete: " . ($completedMatches === $totalMatches ? "YES ✅" : "NO ❌") . "\n\n";

    return $completedMatches === $totalMatches;
}

// Check all rounds
$currentRound = 1;
$allRoundsComplete = true;

while (true) {
    $hasMatches = $championship->matches()
        ->where('round_number', $currentRound)
        ->exists();

    if (!$hasMatches) break;

    $isComplete = checkRoundStatus($championship, $currentRound);
    if (!$isComplete) $allRoundsComplete = false;
    $currentRound++;
}

echo "📈 Current State:\n";
echo "   - Last round with matches: " . ($currentRound - 1) . "\n";
echo "   - All rounds complete: " . ($allRoundsComplete ? "YES ✅" : "NO ❌") . "\n\n";

// Check if next round should be generated
echo "🤖 Auto-Generation Logic:\n";

// Get current round number from GenerateNextRoundJob logic
$lastRound = $championship->matches()->max('round_number');
$currentRoundNumber = $lastRound ?: 0;
echo "   - Current round number: {$currentRoundNumber}\n";

// Check if championship should continue (from GenerateNextRoundJob)
$format = $championship->getFormatEnum();
echo "   - Format: {$format->value}\n";

switch ($format->value) {
    case 'swiss_only':
        $shouldContinue = $currentRoundNumber < $championship->swiss_rounds;
        echo "   - Should continue: " . ($shouldContinue ? "YES ({$currentRoundNumber} < {$championship->swiss_rounds})" : "NO (reached max rounds)") . "\n";
        break;
    case 'elimination_only':
        echo "   - Should continue: [Elimination logic - not implemented for this test]" . "\n";
        break;
    case 'hybrid':
        $totalSwissRounds = $championship->swiss_rounds;
        if ($currentRoundNumber < $totalSwissRounds) {
            $shouldContinue = true;
            echo "   - Should continue: YES (still in Swiss phase: {$currentRoundNumber} < {$totalSwissRounds})" . "\n";
        } else {
            echo "   - Should continue: [Elimination phase logic - not implemented for this test]" . "\n";
        }
        break;
}

echo "\n💡 Recommendation:\n";
if ($allRoundsComplete && $shouldContinue ?? true) {
    echo "   🟢 ROUND 3 SHOULD BE AUTO-GENERATED\n";
    echo "   - All previous rounds are complete\n";
    echo "   - Championship should continue\n";
    echo "   - GenerateNextRoundJob should trigger automatically\n";
} else {
    echo "   🟡 ROUND 3 SHOULD NOT BE GENERATED YET\n";
    if (!$allRoundsComplete) {
        echo "   - Not all rounds are complete yet\n";
    }
    if (!($shouldContinue ?? true)) {
        echo "   - Championship should not continue\n";
    }
}

echo "\n🔧 Manual Generation Options:\n";
echo "   1. Via API: POST /api/championships/14/generate-next-round\n";
echo "   2. Via Laravel: php artisan championship:generate-round 14\n";
echo "   3. Via Admin Controller (if exists)\n";

echo "\n✅ Analysis complete\n";