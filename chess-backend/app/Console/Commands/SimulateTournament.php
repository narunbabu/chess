<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\User;
use App\Services\SwissPairingService;
use App\Services\StandingsCalculatorService;
use App\Enums\ChampionshipMatchStatus;
use App\Enums\ChampionshipResultType;
use App\Enums\ChampionshipRoundType;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SimulateTournament extends Command
{
    protected $signature = 'tournament:simulate
        {--players=16 : Number of players (4-32)}
        {--rounds=5 : Number of Swiss rounds}
        {--upset-chance=15 : Upset probability percentage (0-50)}
        {--draw-chance=20 : Draw probability percentage (0-50)}
        {--cleanup : Delete test tournament data after simulation}';

    protected $description = 'Simulate a complete Swiss tournament with dummy players and realistic results';

    private SwissPairingService $swissPairingService;
    private StandingsCalculatorService $standingsService;

    /** @var array<int, array{id: int, name: string, rating: int}> */
    private array $playerProfiles = [];

    public function handle(): int
    {
        $playerCount = (int) $this->option('players');
        $rounds = (int) $this->option('rounds');
        $upsetChance = (int) $this->option('upset-chance');
        $drawChance = (int) $this->option('draw-chance');

        // Validate inputs
        if ($playerCount < 4 || $playerCount > 32) {
            $this->error('Player count must be between 4 and 32.');
            return 1;
        }
        if ($rounds < 1 || $rounds > 10) {
            $this->error('Rounds must be between 1 and 10.');
            return 1;
        }

        $this->swissPairingService = new SwissPairingService();
        $this->standingsService = new StandingsCalculatorService();

        $this->renderBanner($playerCount, $rounds, $upsetChance, $drawChance);

        try {
            // Phase 1: Create tournament
            $championship = $this->createTournament($playerCount, $rounds);

            // Phase 2: Create and register players
            $users = $this->createPlayers($championship, $playerCount);

            // Phase 3: Run each round
            for ($round = 1; $round <= $rounds; $round++) {
                $this->simulateRound($championship, $round, $rounds, $upsetChance, $drawChance);
            }

            // Phase 4: Final standings
            $this->renderFinalStandings($championship);

            // Phase 5: Tournament statistics
            $this->renderStatistics($championship, $rounds);

            // Cleanup if requested
            if ($this->option('cleanup')) {
                $this->cleanupTournament($championship);
            } else {
                $this->newLine();
                $this->info("Tournament ID: {$championship->id}");
                $this->comment('Run with --cleanup to delete test data after simulation.');
            }

            return 0;
        } catch (\Exception $e) {
            $this->error("Simulation failed: {$e->getMessage()}");
            $this->error($e->getTraceAsString());
            return 1;
        }
    }

    private function renderBanner(int $players, int $rounds, int $upsetChance, int $drawChance): void
    {
        $this->newLine();
        $this->line('╔══════════════════════════════════════════════════════════╗');
        $this->line('║          CHESS TOURNAMENT SIMULATION ENGINE             ║');
        $this->line('╠══════════════════════════════════════════════════════════╣');
        $this->line("║  Players: {$this->pad($players, 3)}  │  Rounds: {$this->pad($rounds, 2)}  │  Format: Swiss          ║");
        $this->line("║  Upset %: {$this->pad($upsetChance, 3)}  │  Draw %: {$this->pad($drawChance, 2)}  │  Bye Pts: 1.0           ║");
        $this->line('╚══════════════════════════════════════════════════════════╝');
        $this->newLine();
    }

    private function pad(int|string $value, int $width): string
    {
        return str_pad((string) $value, $width, ' ', STR_PAD_LEFT);
    }

    private function createTournament(int $playerCount, int $rounds): Championship
    {
        $this->info('Phase 1: Creating tournament...');

        // Ensure lookup tables are seeded
        $this->seedLookupTablesIfEmpty();

        $championship = Championship::create([
            'title' => "[SIM] Swiss Tournament - {$playerCount}P x {$rounds}R - " . now()->format('Y-m-d H:i'),
            'format' => 'swiss_only',
            'swiss_rounds' => $rounds,
            'status_id' => 3, // IN_PROGRESS
            'match_time_window_hours' => 24,
            'is_test_tournament' => true,
            'registration_deadline' => now()->addDays(7),
            'start_date' => now(),
            'color_assignment_method' => 'balanced',
            'tournament_settings' => ['bye_points' => 1.0],
        ]);

        $this->info("  Created championship #{$championship->id}");
        return $championship;
    }

    private function createPlayers(Championship $championship, int $playerCount): array
    {
        $this->info("Phase 2: Registering {$playerCount} players...");

        // Realistic player profiles with varied ratings
        $namePool = [
            'Magnus', 'Hikaru', 'Fabiano', 'Ian', 'Ding', 'Alireza',
            'Anish', 'Wesley', 'Levon', 'Maxime', 'Viswanathan', 'Sergey',
            'Alexander', 'Teimour', 'Shakhriyar', 'Peter', 'Pentala',
            'Veselin', 'Boris', 'Vladimir', 'Garry', 'Anatoly',
            'Bobby', 'Jose', 'Emanuel', 'Mikhail', 'Tigran',
            'Vassily', 'Viktor', 'Jan', 'Richard', 'Samuel',
        ];
        $surnamePool = [
            'Carlsen', 'Nakamura', 'Caruana', 'Nepomniachtchi', 'Liren', 'Firouzja',
            'Giri', 'So', 'Aronian', 'Lagarde', 'Anand', 'Karjakin',
            'Grischuk', 'Radjabov', 'Mamedyarov', 'Svidler', 'Harikrishna',
            'Topalov', 'Gelfand', 'Kramnik', 'Kasparov', 'Karpov',
            'Fischer', 'Capablanca', 'Lasker', 'Tal', 'Petrosian',
            'Smyslov', 'Korchnoi', 'Timman', 'Rapport', 'Shankland',
        ];

        $users = [];
        // Generate ratings with realistic distribution (spread around 1500)
        $ratings = $this->generateRatingDistribution($playerCount);

        $this->newLine();
        $headers = ['#', 'Name', 'Rating', 'Status'];
        $rows = [];

        for ($i = 0; $i < $playerCount; $i++) {
            $firstName = $namePool[$i % count($namePool)];
            $surname = $surnamePool[$i % count($surnamePool)];
            $fullName = "{$firstName} {$surname}";
            $username = "sim_{$firstName}_{$surname}_" . time();
            $rating = $ratings[$i];

            $user = User::firstOrCreate([
                'email' => "sim_{$i}_" . time() . "@tournament.test",
            ], [
                'name' => $fullName,
                'username' => $username,
                'rating' => $rating,
                'password' => bcrypt('simulation'),
            ]);

            $championship->participants()->create([
                'user_id' => $user->id,
                'seeded' => false,
                'payment_status_id' => 2, // COMPLETED - bypass payment check
            ]);

            $this->playerProfiles[$user->id] = [
                'id' => $user->id,
                'name' => $fullName,
                'rating' => $rating,
            ];

            $users[] = $user;
            $rows[] = [$i + 1, $fullName, $rating, 'Registered'];
        }

        $this->table($headers, $rows);
        $this->info("  {$playerCount} players registered successfully.");
        return $users;
    }

    private function generateRatingDistribution(int $count): array
    {
        $ratings = [];
        // Create a realistic spread: top seed ~1800, bottom seed ~1200
        for ($i = 0; $i < $count; $i++) {
            $base = 1800 - (int) (($i / max($count - 1, 1)) * 600);
            // Add some randomness (+/- 50)
            $jitter = rand(-50, 50);
            $ratings[] = max(800, min(2200, $base + $jitter));
        }
        rsort($ratings); // Highest first
        return $ratings;
    }

    private function simulateRound(Championship $championship, int $round, int $totalRounds, int $upsetChance, int $drawChance): void
    {
        $this->newLine();
        $this->line('┌──────────────────────────────────────────────────────────┐');
        $this->line("│                    ROUND {$round} OF {$totalRounds}                            │");
        $this->line('└──────────────────────────────────────────────────────────┘');

        // Generate pairings
        $this->comment("  Generating Swiss pairings...");
        $pairings = $this->swissPairingService->generatePairings($championship, $round);
        $this->info("  Generated " . count($pairings) . " pairings.");

        // Simulate and record results
        $headers = ['Board', 'White', 'Rtg', 'Result', 'Black', 'Rtg', 'Type'];
        $rows = [];
        $board = 1;

        foreach ($pairings as $pairing) {
            if (isset($pairing['is_bye']) && $pairing['is_bye']) {
                $byePlayer = $this->playerProfiles[$pairing['player1_id']] ?? ['name' => "Player #{$pairing['player1_id']}", 'rating' => '?'];
                $rows[] = [$board, $byePlayer['name'], $byePlayer['rating'], 'BYE', '---', '---', 'bye'];

                // BYE match is already created by SwissPairingService::handleBye()
                // Just need to mark it completed
                $byeMatch = $championship->matches()
                    ->where('round_number', $round)
                    ->where('player1_id', $pairing['player1_id'])
                    ->whereNull('player2_id')
                    ->first();

                if ($byeMatch) {
                    $byeMatch->update([
                        'status_id' => ChampionshipMatchStatus::COMPLETED->getId(),
                        'result_type_id' => ChampionshipResultType::BYE->getId(),
                    ]);
                }

                $board++;
                continue;
            }

            $whiteId = $pairing['player1_id'];
            $blackId = $pairing['player2_id'];
            $white = $this->playerProfiles[$whiteId] ?? ['name' => "Player #{$whiteId}", 'rating' => 1200];
            $black = $this->playerProfiles[$blackId] ?? ['name' => "Player #{$blackId}", 'rating' => 1200];

            // Simulate result
            $result = $this->simulateGameResult($white['rating'], $black['rating'], $upsetChance, $drawChance);

            // Create completed match record
            $matchData = [
                'championship_id' => $championship->id,
                'round_number' => $round,
                'round_type' => ChampionshipRoundType::SWISS,
                'player1_id' => $whiteId,
                'player2_id' => $blackId,
                'white_player_id' => $whiteId,
                'black_player_id' => $blackId,
                'color_assignment_method' => 'balanced',
                'auto_generated' => true,
                'scheduled_at' => now(),
                'deadline' => now()->addHours(24),
                'status_id' => ChampionshipMatchStatus::COMPLETED->getId(),
            ];

            switch ($result['outcome']) {
                case 'white_wins':
                    $matchData['winner_id'] = $whiteId;
                    $matchData['result_type_id'] = ChampionshipResultType::COMPLETED->getId();
                    $resultStr = '1 - 0';
                    break;
                case 'black_wins':
                    $matchData['winner_id'] = $blackId;
                    $matchData['result_type_id'] = ChampionshipResultType::COMPLETED->getId();
                    $resultStr = '0 - 1';
                    break;
                case 'draw':
                    $matchData['winner_id'] = null;
                    $matchData['result_type_id'] = ChampionshipResultType::DRAW->getId();
                    $resultStr = '½ - ½';
                    break;
            }

            ChampionshipMatch::create($matchData);

            $shortWhite = mb_substr($white['name'], 0, 18);
            $shortBlack = mb_substr($black['name'], 0, 18);
            $rows[] = [
                $board,
                $shortWhite,
                $white['rating'],
                $resultStr,
                $shortBlack,
                $black['rating'],
                $result['type'],
            ];

            $board++;
        }

        $this->table($headers, $rows);

        // Update standings
        $this->comment("  Calculating standings...");
        $this->standingsService->updateStandings($championship);

        // Show current standings after round
        $this->renderRoundStandings($championship, $round);
    }

    /**
     * Simulate a game result based on rating difference, upset chance, and draw chance.
     */
    private function simulateGameResult(int $whiteRating, int $blackRating, int $upsetChance, int $drawChance): array
    {
        $roll = rand(1, 100);

        // Check for draw first
        if ($roll <= $drawChance) {
            return ['outcome' => 'draw', 'type' => 'draw'];
        }

        // Rating-based win probability (Elo formula simplified)
        $ratingDiff = $whiteRating - $blackRating;
        // White has slight advantage (+30 Elo equivalent)
        $expectedWhite = 1.0 / (1.0 + pow(10, (-$ratingDiff - 30) / 400));

        // Check for upset
        $isUpset = rand(1, 100) <= $upsetChance;

        $winRoll = rand(1, 1000) / 1000.0;

        if ($isUpset) {
            // Reverse the expected outcome
            if ($winRoll < $expectedWhite) {
                return ['outcome' => 'black_wins', 'type' => 'upset'];
            } else {
                return ['outcome' => 'white_wins', 'type' => 'upset'];
            }
        }

        // Normal result based on rating
        if ($winRoll < $expectedWhite) {
            return ['outcome' => 'white_wins', 'type' => 'normal'];
        } else {
            return ['outcome' => 'black_wins', 'type' => 'normal'];
        }
    }

    private function renderRoundStandings(Championship $championship, int $round): void
    {
        $standings = $championship->standings()
            ->with('user')
            ->orderBy('points', 'desc')
            ->orderBy('buchholz_score', 'desc')
            ->orderBy('sonneborn_berger', 'desc')
            ->get();

        $this->newLine();
        $this->info("  Standings after Round {$round}:");

        $headers = ['Rank', 'Player', 'Rating', 'Pts', 'W', 'D', 'L', 'Buchholz', 'SB'];
        $rows = [];
        $rank = 1;

        foreach ($standings as $standing) {
            $profile = $this->playerProfiles[$standing->user_id] ?? null;
            $name = $profile ? mb_substr($profile['name'], 0, 22) : "Player #{$standing->user_id}";
            $rating = $profile['rating'] ?? '?';

            $rows[] = [
                $rank,
                $name,
                $rating,
                number_format($standing->points, 1),
                $standing->wins,
                $standing->draws,
                $standing->losses,
                number_format($standing->buchholz_score, 1),
                number_format($standing->sonneborn_berger, 1),
            ];
            $rank++;
        }

        $this->table($headers, $rows);
    }

    private function renderFinalStandings(Championship $championship): void
    {
        // Final recalculation to ensure accuracy
        $this->standingsService->updateStandings($championship);

        $standings = $championship->standings()
            ->with('user')
            ->orderBy('points', 'desc')
            ->orderBy('buchholz_score', 'desc')
            ->orderBy('sonneborn_berger', 'desc')
            ->get();

        $this->newLine();
        $this->line('╔══════════════════════════════════════════════════════════╗');
        $this->line('║              FINAL TOURNAMENT STANDINGS                 ║');
        $this->line('╚══════════════════════════════════════════════════════════╝');
        $this->newLine();

        $headers = ['Rank', 'Player', 'Rating', 'Points', 'W', 'D', 'L', 'Buchholz', 'SB', 'Perf'];
        $rows = [];
        $rank = 1;

        foreach ($standings as $standing) {
            $profile = $this->playerProfiles[$standing->user_id] ?? null;
            $name = $profile ? $profile['name'] : "Player #{$standing->user_id}";
            $rating = $profile['rating'] ?? 1200;

            // Calculate performance rating estimate
            $perfRating = $this->estimatePerformanceRating($standing, $rating);

            // Medal/highlight for top 3
            $prefix = match($rank) {
                1 => '[1st]',
                2 => '[2nd]',
                3 => '[3rd]',
                default => (string) $rank,
            };

            $rows[] = [
                $prefix,
                mb_substr($name, 0, 22),
                $rating,
                number_format($standing->points, 1),
                $standing->wins,
                $standing->draws,
                $standing->losses,
                number_format($standing->buchholz_score, 1),
                number_format($standing->sonneborn_berger, 1),
                $perfRating,
            ];
            $rank++;
        }

        $this->table($headers, $rows);

        // Announce winner
        $winner = $standings->first();
        if ($winner) {
            $winnerProfile = $this->playerProfiles[$winner->user_id] ?? null;
            $winnerName = $winnerProfile ? $winnerProfile['name'] : "Player #{$winner->user_id}";
            $this->newLine();
            $this->line("  CHAMPION: {$winnerName} with {$winner->points} points!");
        }
    }

    private function estimatePerformanceRating($standing, int $baseRating): string
    {
        $played = $standing->matches_played;
        if ($played === 0) {
            return '---';
        }

        $score = $standing->points / $played;
        // Simplified performance rating formula
        $diff = match(true) {
            $score >= 0.95 => 400,
            $score >= 0.85 => 300,
            $score >= 0.75 => 200,
            $score >= 0.65 => 120,
            $score >= 0.55 => 50,
            $score >= 0.45 => -50,
            $score >= 0.35 => -120,
            $score >= 0.25 => -200,
            $score >= 0.15 => -300,
            default => -400,
        };

        return (string) ($baseRating + $diff);
    }

    private function renderStatistics(Championship $championship, int $rounds): void
    {
        $matches = $championship->matches()->get();
        $totalMatches = $matches->count();
        $completedMatches = $matches->where('status_id', ChampionshipMatchStatus::COMPLETED->getId())->count();
        $byeMatches = $matches->whereNull('player2_id')->count();
        $regularMatches = $totalMatches - $byeMatches;

        // Count results
        $whiteWins = $matches->whereNotNull('winner_id')
            ->filter(fn($m) => $m->winner_id === $m->white_player_id && $m->player2_id !== null)
            ->count();
        $blackWins = $matches->whereNotNull('winner_id')
            ->filter(fn($m) => $m->winner_id === $m->black_player_id && $m->player2_id !== null)
            ->count();
        $draws = $matches->whereNull('winner_id')
            ->whereNotNull('player2_id')
            ->where('status_id', ChampionshipMatchStatus::COMPLETED->getId())
            ->count();

        $this->newLine();
        $this->line('┌──────────────────────────────────────────────────────────┐');
        $this->line('│                 TOURNAMENT STATISTICS                    │');
        $this->line('└──────────────────────────────────────────────────────────┘');
        $this->newLine();

        $statsRows = [
            ['Total Rounds', $rounds],
            ['Total Matches', $totalMatches],
            ['Regular Games', $regularMatches],
            ['Byes Awarded', $byeMatches],
            ['Completed', $completedMatches],
            ['', ''],
            ['White Wins', "{$whiteWins} (" . ($regularMatches > 0 ? round($whiteWins / $regularMatches * 100, 1) : 0) . '%)'],
            ['Black Wins', "{$blackWins} (" . ($regularMatches > 0 ? round($blackWins / $regularMatches * 100, 1) : 0) . '%)'],
            ['Draws', "{$draws} (" . ($regularMatches > 0 ? round($draws / $regularMatches * 100, 1) : 0) . '%)'],
        ];

        $this->table(['Metric', 'Value'], $statsRows);

        // Validate standings integrity
        $errors = $this->standingsService->validateStandings($championship);
        if (empty($errors)) {
            $this->info('  Standings integrity: PASSED');
        } else {
            $this->error('  Standings integrity: FAILED');
            foreach ($errors as $error) {
                $this->error("    - {$error}");
            }
        }
    }

    private function seedLookupTablesIfEmpty(): void
    {
        $this->comment('  Ensuring lookup tables are populated...');

        $lookupTables = [
            'championship_formats' => [
                ['id' => 1, 'code' => 'swiss_elimination', 'label' => 'Swiss + Elimination'],
                ['id' => 2, 'code' => 'swiss_only', 'label' => 'Swiss Only'],
                ['id' => 3, 'code' => 'elimination_only', 'label' => 'Single Elimination'],
            ],
            'championship_statuses' => [
                ['id' => 1, 'code' => 'upcoming', 'label' => 'Upcoming'],
                ['id' => 2, 'code' => 'registration_open', 'label' => 'Registration Open'],
                ['id' => 3, 'code' => 'in_progress', 'label' => 'In Progress'],
                ['id' => 4, 'code' => 'cancelled', 'label' => 'Cancelled'],
                ['id' => 5, 'code' => 'completed', 'label' => 'Completed'],
                ['id' => 6, 'code' => 'paused', 'label' => 'Paused'],
            ],
            'championship_match_statuses' => [
                ['id' => 1, 'code' => 'pending', 'label' => 'Pending'],
                ['id' => 2, 'code' => 'in_progress', 'label' => 'In Progress'],
                ['id' => 3, 'code' => 'completed', 'label' => 'Completed'],
                ['id' => 4, 'code' => 'cancelled', 'label' => 'Cancelled'],
            ],
            'championship_result_types' => [
                ['id' => 1, 'code' => 'completed', 'label' => 'Completed Normally'],
                ['id' => 2, 'code' => 'forfeit_player1', 'label' => 'Player 1 Forfeit'],
                ['id' => 3, 'code' => 'forfeit_player2', 'label' => 'Player 2 Forfeit'],
                ['id' => 4, 'code' => 'double_forfeit', 'label' => 'Double Forfeit'],
                ['id' => 5, 'code' => 'draw', 'label' => 'Draw'],
                ['id' => 6, 'code' => 'bye', 'label' => 'Bye'],
            ],
            'championship_round_types' => [
                ['id' => 1, 'code' => 'swiss', 'label' => 'Swiss'],
                ['id' => 2, 'code' => 'round_of_16', 'label' => 'Round of 16'],
                ['id' => 3, 'code' => 'quarter_final', 'label' => 'Quarter Final'],
                ['id' => 4, 'code' => 'semi_final', 'label' => 'Semi Final'],
                ['id' => 5, 'code' => 'final', 'label' => 'Final'],
                ['id' => 6, 'code' => 'third_place', 'label' => 'Third Place'],
            ],
            'payment_statuses' => [
                ['id' => 1, 'code' => 'pending', 'label' => 'Pending'],
                ['id' => 2, 'code' => 'completed', 'label' => 'Completed'],
                ['id' => 3, 'code' => 'failed', 'label' => 'Failed'],
                ['id' => 4, 'code' => 'refunded', 'label' => 'Refunded'],
            ],
        ];

        $seeded = false;
        foreach ($lookupTables as $table => $rows) {
            foreach ($rows as $row) {
                $existsById = DB::table($table)->where('id', $row['id'])->exists();
                $existsByCode = DB::table($table)->where('code', $row['code'])->exists();
                if (!$existsById && !$existsByCode) {
                    DB::table($table)->insert(array_merge($row, [
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]));
                    $seeded = true;
                }
            }
        }

        if ($seeded) {
            $this->comment('  Lookup tables seeded.');
            // Clear model caches
            \App\Models\ChampionshipFormat::clearCache();
            \App\Models\ChampionshipStatus::clearCache();
        }
    }

    private function cleanupTournament(Championship $championship): void
    {
        $this->newLine();
        $this->comment('  Cleaning up test tournament data...');

        DB::transaction(function () use ($championship) {
            $championship->standings()->delete();
            $championship->matches()->delete();

            // Delete test participants (but not the users themselves to avoid FK issues)
            $championship->participants()->delete();

            $championship->delete();
        });

        $this->info('  Test tournament data cleaned up successfully.');
    }
}
