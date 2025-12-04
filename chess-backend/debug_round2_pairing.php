<?php

require __DIR__ . '/vendor/autoload.php';

use App\Models\Championship;
use App\Models\User;
use App\Models\ChampionshipParticipant;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipStanding;
use App\Services\SwissPairingService;
use App\Services\StandingsCalculatorService;
use App\Enums\PaymentStatus;
use App\Enums\ChampionshipMatchStatus;
use App\Enums\ChampionshipResultType;

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "🔍 DEBUG: Round 2 Pairing Generation\n";
echo "====================================\n\n";

// Create test championship
$championship = Championship::create([
    'title' => "Round 2 Debug Test",
    'format_id' => 1,
    'status_id' => \App\Enums\ChampionshipStatus::IN_PROGRESS->getId(),
    'match_time_window_hours' => 24,
    'registration_deadline' => now()->addDays(7),
    'start_date' => now()->addDay(),
    'total_rounds' => 10,
    'visibility' => 'public',
    'is_test_tournament' => true,
]);

echo "Created championship ID: {$championship->id}\n";

// Create 4 participants (simpler for debugging)
$participants = [];
for ($i = 1; $i <= 4; $i++) {
    $user = User::factory()->create([
        'name' => "Player " . chr(64 + $i), // A, B, C, D
        'rating' => 1500 - ($i * 10),
    ]);

    $participant = ChampionshipParticipant::create([
        'championship_id' => $championship->id,
        'user_id' => $user->id,
        'payment_status_id' => PaymentStatus::COMPLETED->getId(),
    ]);

    $participants[] = $participant;
}

echo "Created " . count($participants) . " participants\n";

// Generate Round 1 pairings
$swissService = new SwissPairingService();
echo "\n🔵 Generating Round 1 pairings...\n";
$round1Pairings = $swissService->generatePairings($championship, 1);
echo "Round 1 pairings: " . count($round1Pairings) . "\n";

// Create Round 1 matches manually to avoid broadcasting
$round1Matches = collect();
foreach ($round1Pairings as $index => $pairing) {
    if (!isset($pairing['is_bye']) || !$pairing['is_bye']) {
        $match = ChampionshipMatch::create([
            'championship_id' => $championship->id,
            'round_number' => 1,
            'round_type' => \App\Enums\ChampionshipRoundType::SWISS,
            'player1_id' => $pairing['player1_id'],
            'player2_id' => $pairing['player2_id'],
            'white_player_id' => $pairing['player1_id'],
            'black_player_id' => $pairing['player2_id'],
            'auto_generated' => true,
            'scheduled_at' => now(),
            'deadline' => now()->addHours(24),
            'status' => ChampionshipMatchStatus::PENDING,
        ]);
        $round1Matches->push($match);
    }
}
echo "Round 1 matches created: " . $round1Matches->count() . "\n";

// Complete Round 1 matches with simple results
echo "\n🏁 Completing Round 1 matches...\n";
foreach ($round1Matches as $match) {
    if (!$match->is_placeholder && $match->player1_id && $match->player2_id) {
        // Simple: player 1 wins all matches for consistent debugging
        $match->update([
            'status_id' => ChampionshipMatchStatus::COMPLETED->getId(),
            'winner_id' => $match->player1_id,
            'player1_result_type_id' => ChampionshipResultType::COMPLETED->getId(),
            'player2_result_type_id' => ChampionshipResultType::FORFEIT_PLAYER2->getId(),
            'completed_at' => now(),
        ]);

        echo "  Match {$match->id}: {$match->player1->name} beats {$match->player2->name}\n";
    }
}

// Update standings
echo "\n📊 Updating standings...\n";
$standingsService = new StandingsCalculatorService();
$standingsService->updateStandings($championship);

// Show standings
echo "\n📈 Current Standings:\n";
$standings = $championship->standings()->orderBy('rank')->get();
foreach ($standings as $standing) {
    echo "  {$standing->rank}. {$standing->user->name}: {$standing->points} pts\n";
}

// Generate Round 2 pairings
echo "\n🔵 Generating Round 2 pairings...\n";
try {
    $round2Pairings = $swissService->generatePairings($championship, 2);
    echo "Round 2 pairings: " . count($round2Pairings) . "\n";

    foreach ($round2Pairings as $pairing) {
        if (isset($pairing['is_bye']) && $pairing['is_bye']) {
            echo "  BYE: Player {$pairing['player1_id']}\n";
        } else {
            $player1Name = User::find($pairing['player1_id'])->name ?? "Unknown";
            $player2Name = User::find($pairing['player2_id'])->name ?? "Unknown";
            echo "  Match: {$player1Name} vs {$player2Name}\n";
        }
    }
} catch (Exception $e) {
    echo "❌ ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}

echo "\n✅ Debug completed\n";