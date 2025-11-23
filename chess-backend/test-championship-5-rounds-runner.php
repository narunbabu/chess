<?php

require_once __DIR__ . '/vendor/autoload.php';

use App\Models\Championship;
use App\Models\User;
use Database\Seeders\ChampionshipTestSeeder5Rounds;

/**
 * Championship Test Runner for 5-Round Tournament
 *
 * This script creates and manages a test championship with 5 rounds and specific standings:
 * - Round 1 & 2: Completed with Sanatan as clear leader
 * - Round 3: Current active round (selective matches)
 * - Round 4 & 5: Future rounds
 *
 * Final Standings Goal:
 * 1st: Sanatan Dharmam (sanatan.dharmam@gmail.com) - Topper
 * 2nd: Arun Nalamara (nalamara.arun@gmail.com)
 * 3rd: Arun Babu (narun.iitb@gmail.com)
 */

class ChampionshipTestRunner5Rounds
{
    private $championshipId = null;

    public function __construct()
    {
        $this->championshipId = $this->getOrCreateChampionship();
    }

    public function run($command = null)
    {
        switch ($command) {
            case 'create':
                $this->createChampionship();
                break;

            case 'analyze':
                $this->analyzeChampionship();
                break;

            case 'reset':
                $this->resetChampionship();
                break;

            case 'complete-round3':
                $this->completeRound3();
                break;

            case 'help':
                $this->showHelp();
                break;

            default:
                $this->showStatus();
                $this->showHelp();
        }
    }

    private function createChampionship()
    {
        echo "\n🏆 Creating 5-Round Test Championship...\n";

        // Use Laravel's seeder
        $seeder = new ChampionshipTestSeeder5Rounds();
        $seeder->run();

        // Get the created championship
        $championship = Championship::where('title', 'Test Championship 5 Rounds - Pre-configured')->first();

        if ($championship) {
            $this->championshipId = $championship->id;
            $this->saveChampionshipId();
            echo "\n✅ Championship created successfully!\n";
            $this->showStatus();
        } else {
            echo "\n❌ Failed to create championship\n";
        }
    }

    private function analyzeChampionship()
    {
        $championship = $this->getChampionship();
        if (!$championship) {
            echo "\n❌ No championship found. Please create one first.\n";
            return;
        }

        echo "\n📊 CHAMPIONSHIP ANALYSIS: {$championship->title}\n";
        echo str_repeat("=", 70) . "\n";

        // Championship details
        echo "\n📋 Championship Details:\n";
        echo "   ID: {$championship->id}\n";
        echo "   Title: {$championship->title}\n";
        echo "   Status: {$championship->status}\n";
        echo "   Format: {$championship->format}\n";
        echo "   Total Rounds: {$championship->total_rounds}\n";
        echo "   Max Participants: {$championship->max_participants}\n";
        echo "   Entry Fee: \${$championship->entry_fee}\n";
        echo "   Auto Progression: " . ($championship->auto_progression ? 'Yes' : 'No') . "\n";

        // Show tournament configuration
        echo "\n⚙️ Tournament Configuration:\n";
        if ($championship->tournament_config) {
            $config = $championship->tournament_config;
            echo "   Mode: " . ($config['mode'] ?? 'N/A') . "\n";
            echo "   Auto Advance: " . (($config['auto_advance_enabled'] ?? false) ? 'Yes' : 'No') . "\n";
            echo "   Coverage Enforcement: " . ($config['coverage_enforcement'] ?? 'N/A') . "\n";
            echo "   Pairing Policy: " . ($config['pairing_policy'] ?? 'N/A') . "\n";
        }

        // Participants
        $participants = $championship->participants()->with('user')->get();
        echo "\n👥 Participants (" . $participants->count() . "):\n";
        foreach ($participants as $p) {
            echo "   • {$p->user->name} ({$p->user->email}) - Rating: {$p->user->rating}\n";
        }

        // Match summary by round
        $matches = $championship->matches()->get();
        echo "\n🎯 Match Summary:\n";

        for ($round = 1; $round <= $championship->total_rounds; $round++) {
            $roundMatches = $matches->where('round', $round);
            $pending = $roundMatches->where('status', 'pending')->count();
            $active = $roundMatches->where('status', 'active')->count();
            $completed = $roundMatches->where('status', 'completed')->count();

            $status = $completed > 0 ? "✅ Completed" : ($pending > 0 ? "⏳ Scheduled" : "🔒 Not Generated");
            echo sprintf("   Round %d: %d total, %d completed, %d active, %d pending %s\n",
                $round, $roundMatches->count(), $completed, $active, $pending, $status);
        }

        // Standings
        $standings = $championship->standings()->with('user')->get();
        if ($standings->count() > 0) {
            echo "\n🏆 Current Standings:\n";
            foreach ($standings->sortBy('position') as $standing) {
                echo sprintf("   %d. %s: %.1f points (%d-%d-%d) Tie-break: %.1f\n",
                    $standing->position,
                    $standing->user->name,
                    $standing->points,
                    $standing->games_won,
                    $standing->games_drawn,
                    $standing->games_lost,
                    $standing->tie_break_score ?? 0
                );
            }
        }

        // Round 3 specific details (current active round)
        $round3Matches = $matches->where('round', 3);
        if ($round3Matches->count() > 0) {
            echo "\n🎮 Round 3 Details (Current Active Round):\n";
            echo "   Type: Selective (top 3 players only)\n";
            echo "   Coverage Pairs: [1st vs 2nd], [2nd vs 3rd]\n";

            foreach ($round3Matches as $match) {
                $whiteName = User::find($match->white_player_id)->name ?? 'Unknown';
                $blackName = User::find($match->black_player_id)->name ?? 'Unknown';
                $status = ucfirst($match->status);
                $scheduled = $match->scheduled_at ? $match->scheduled_at->format('M j, Y H:i') : 'Not scheduled';

                echo sprintf("   Match %d: %s (White) vs %s (Black) - %s\n",
                    $match->match_number, $whiteName, $blackName, $status);
                echo sprintf("            Scheduled: %s\n", $scheduled);
                echo sprintf("            Time Window: %d hours\n", $match->match_time_window_hours ?? 72);
            }
        }

        // Round activation explanation
        echo "\n🔄 Round Activation Explanation:\n";
        echo "   Current Round: 3 (Active)\n";
        echo "   Auto Progression: " . ($championship->auto_progression ? 'Enabled - matches will auto-generate when Round 3 completes' : 'Disabled - admin must manually generate Round 4') . "\n";

        if (!$championship->auto_progression) {
            echo "\n   ⚠️ MANUAL ACTIVATION REQUIRED:\n";
            echo "   To activate Round 4 when Round 3 completes, run:\n";
            echo "   php artisan championship:generate-round {$championship->id}\n";
            echo "   OR use the admin panel to generate the next round\n";
        }

        // Next steps
        echo "\n📝 Next Steps:\n";
        echo "   1. Play Round 3 matches (currently scheduled)\n";
        echo "   2. Complete all Round 3 matches\n";
        echo "   3. Round 4 will " . ($championship->auto_progression ? "auto-generate" : "require manual generation") . "\n";
        echo "   4. Round 5 (Finals) will be between top 2 players\n";
    }

    private function completeRound3()
    {
        $championship = $this->getChampionship();
        if (!$championship) {
            echo "\n❌ No championship found.\n";
            return;
        }

        // Simulate completing Round 3
        $round3Matches = $championship->matches()->where('round', 3)->get();

        echo "\n🎮 Completing Round 3 matches...\n";

        foreach ($round3Matches as $match) {
            // Simulate Sanatan winning his Round 3 matches
            $winnerId = ($match->white_player_id == 1 || $match->black_player_id == 1) ? 1 :
                       (($match->white_player_id == 2 || $match->black_player_id == 2) ? 2 : 3);

            $match->update([
                'status' => 'completed',
                'result' => 'checkmate',
                'winner_id' => $winnerId,
                'completed_at' => now()
            ]);

            $whiteName = User::find($match->white_player_id)->name ?? 'Unknown';
            $blackName = User::find($match->black_player_id)->name ?? 'Unknown';
            $winnerName = User::find($winnerId)->name ?? 'Unknown';

            echo "   Match completed: {$whiteName} vs {$blackName} - Winner: {$winnerName}\n";
        }

        echo "\n✅ Round 3 completed!\n";

        // Update standings
        $this->updateFinalStandings($championship);

        // Check if Round 4 should be generated
        if ($championship->auto_progression) {
            echo "\n🔄 Auto-progression enabled - Round 4 should generate automatically.\n";
        } else {
            echo "\n⚠️ Auto-progression disabled - To generate Round 4, run:\n";
            echo "   php artisan championship:generate-round {$championship->id}\n";
        }

        $this->showStatus();
    }

    private function updateFinalStandings($championship)
    {
        // Calculate final standings based on all completed matches
        $participants = $championship->participants()->with('user')->get();

        foreach ($participants as $participant) {
            $matches = $championship->matches()
                ->where(function($query) use ($participant) {
                    $query->where('white_player_id', $participant->user_id)
                          ->orWhere('black_player_id', $participant->user_id);
                })
                ->where('status', 'completed')
                ->get();

            $won = $matches->where('winner_id', $participant->user_id)->count();
            $lost = $matches->where('winner_id', '!=', $participant->user_id)
                           ->where('winner_id', '!=', null)->count();
            $drawn = $matches->count() - $won - $lost;
            $points = $won + ($drawn * 0.5);

            // Update or create standing
            $championship->standings()->updateOrCreate(
                ['user_id' => $participant->user_id],
                [
                    'games_played' => $matches->count(),
                    'games_won' => $won,
                    'games_drawn' => $drawn,
                    'games_lost' => $lost,
                    'points' => $points,
                    'position' => 0, // Will be calculated separately
                ]
            );
        }

        // Update positions
        $standings = $championship->standings()->orderBy('points', 'desc')->orderBy('tie_break_score', 'desc')->get();
        foreach ($standings as $index => $standing) {
            $standing->update(['position' => $index + 1]);
        }
    }

    private function resetChampionship()
    {
        $championship = $this->getChampionship();
        if (!$championship) {
            echo "\n❌ No championship found.\n";
            return;
        }

        echo "\n🔄 Resetting championship...\n";

        // Delete all related data
        $championship->matches()->delete();
        $championship->standings()->delete();
        $championship->participants()->delete();
        $championship->delete();

        // Reset stored ID
        $this->championshipId = null;
        $this->saveChampionshipId();

        echo "\n✅ Championship reset complete!\n";
        echo "Run 'create' to create a new championship.\n";
    }

    private function showStatus()
    {
        $championship = $this->getChampionship();
        if (!$championship) {
            echo "\n📊 Status: No championship found\n";
            return;
        }

        $matches = $championship->matches()->get();
        $round3Matches = $matches->where('round', 3);
        $pendingRound3 = $round3Matches->where('status', 'pending')->count();

        echo "\n📊 CHAMPIONSHIP STATUS\n";
        echo str_repeat("=", 40) . "\n";
        echo "ID: {$championship->id}\n";
        echo "Title: {$championship->title}\n";
        echo "Status: {$championship->status}\n";
        echo "Current Round: 3 (Active)\n";
        echo "Total Rounds: {$championship->total_rounds}\n";
        echo "Auto Progression: " . ($championship->auto_progression ? 'Yes' : 'No') . "\n";
        echo "Round 3 Pending: {$pendingRound3} matches\n";
    }

    private function showHelp()
    {
        echo "\n📖 Available Commands:\n";
        echo "   create              - Create new 5-round test championship\n";
        echo "   analyze             - Detailed championship analysis\n";
        echo "   complete-round3     - Simulate completing Round 3\n";
        echo "   reset               - Reset/delete championship\n";
        echo "   help                - Show this help message\n";
        echo "\n🎯 Championship Structure:\n";
        echo "   Round 1: Completed (Sanatan: 2-0, Arun N: 1-1, Arun B: 0-2)\n";
        echo "   Round 2: Completed (Sanatan: 2-0, Arun N: 1-1, Arun B: 0-2)\n";
        echo "   Round 3: Active (Selective: 1st vs 2nd, 2nd vs 3rd)\n";
        echo "   Round 4: Pending (Selective with coverage pairs [1,3], [2,3])\n";
        echo "   Round 5: Pending (Final: Top 2 players only)\n";
        echo "\n⏰ Round Activation:\n";
        echo "   - Auto Progression: " . ($this->getChampionship()?->auto_progression ? 'ENABLED' : 'DISABLED') . "\n";
        echo "   - Manual generation: php artisan championship:generate-round [ID]\n";
    }

    private function getChampionship()
    {
        if ($this->championshipId) {
            return Championship::find($this->championshipId);
        }

        return Championship::where('title', 'Test Championship 5 Rounds - Pre-configured')->first();
    }

    private function getOrCreateChampionship()
    {
        $idFile = __DIR__ . '/test-championship-id.txt';
        if (file_exists($idFile)) {
            return (int) file_get_contents($idFile);
        }
        return null;
    }

    private function saveChampionshipId()
    {
        $idFile = __DIR__ . '/test-championship-id.txt';
        if ($this->championshipId) {
            file_put_contents($idFile, $this->championshipId);
        } elseif (file_exists($idFile)) {
            unlink($idFile);
        }
    }
}

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

// Run the test runner
$command = $argv[1] ?? null;
$runner = new ChampionshipTestRunner5Rounds();
$runner->run($command);