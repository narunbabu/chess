<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Championship;
use App\Models\ChampionshipParticipant;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipStanding;
use App\Models\Game;
use App\Models\GameMove;
use App\Models\User;
use App\Enums\ChampionshipStatus;
use App\Enums\ChampionshipFormat;
use App\Enums\ChampionshipMatchStatus;
use App\Enums\ChampionshipRoundType;
use App\Enums\ChampionshipResultType;
use App\Enums\PaymentStatus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ChampionshipTestSeeder extends Seeder
{
    /**
     * Test users configuration
     */
    private $testUsers = [
        1 => ['name' => 'Arun Nalamara', 'email' => 'nalamara.arun@gmail.com'],
        2 => ['name' => 'arun babu', 'email' => 'narun.iitb@gmail.com'],
        3 => ['name' => 'Arun Nalamara', 'email' => 'sanatan.dharmam@gmail.com'],
    ];

    /**
     * Create a comprehensive championship testing module
     */
    public function run(): void
    {
        echo "=== Championship Test Seeder ===\n";
        echo "This seeder provides methods to create and manipulate championship states for testing\n\n";

        $this->command->info('Available methods:');
        $this->command->info('1. createTestChampionship() - Create new test championship');
        $this->command->info('2. simulateRoundProgress($championshipId, $roundNumber) - Simulate round completion');
        $this->command->info('3. createChampionshipAtStage($stage) - Create championship at specific stage');
        $this->command->info('4. resetChampionship($championshipId) - Reset championship to initial state');
        $this->command->info('5. analyzeChampionship($championshipId) - Analyze current state');

        echo "\nExample usage in tinker:\n";
        echo "\$seeder = new Database\Seeders\ChampionshipTestSeeder();\n";
        echo "\$champ = \$seeder->createTestChampionship();\n";
        echo "\$seeder->simulateRoundProgress(\$champ->id, 1);\n";
    }

    /**
     * Create a new test championship with 3 participants
     */
    public function createTestChampionship(array $config = []): Championship
    {
        echo "Creating test championship...\n";

        // Default configuration
        $defaultConfig = [
            'title' => 'Test Championship ' . date('Y-m-d H:i:s'),
            'description' => 'Test championship for development',
            'max_participants' => 3,
            'entry_fee' => 0.00,
            'format' => ChampionshipFormat::SWISS_ONLY->value,
            'total_rounds' => 3,
            'swiss_rounds' => 3,
            'time_control_minutes' => 10,
            'time_control_increment' => 0,
            'registration_deadline' => now()->addDays(7),
            'start_date' => now()->addDays(14),
            'visibility' => 'public',
            'allow_public_registration' => true,
            'status' => ChampionshipStatus::REGISTRATION_OPEN->value,
        ];

        $config = array_merge($defaultConfig, $config);

        DB::beginTransaction();
        try {
            // Create championship
            $championship = Championship::create($config);
            echo "Created championship: {$championship->title} (ID: {$championship->id})\n";

            // Add participants
            $this->addParticipants($championship->id);

            // Generate matches for round 1
            $this->generateRoundMatches($championship->id, 1);

            DB::commit();
            echo "Test championship created successfully!\n";
            return $championship;

        } catch (\Exception $e) {
            DB::rollBack();
            echo "Error creating championship: " . $e->getMessage() . "\n";
            throw $e;
        }
    }

    /**
     * Add 3 test participants to championship
     */
    private function addParticipants(int $championshipId): void
    {
        echo "Adding 3 test participants...\n";

        foreach ($this->testUsers as $userId => $userInfo) {
            // Ensure user exists
            $user = User::find($userId);
            if (!$user) {
                echo "Creating test user: {$userInfo['name']} (ID: {$userId})\n";
                $user = User::create([
                    'id' => $userId,
                    'name' => $userInfo['name'],
                    'email' => $userInfo['email'],
                    'password' => bcrypt('password'),
                    'email_verified_at' => now(),
                ]);
            }

            // Add participant
            ChampionshipParticipant::create([
                'championship_id' => $championshipId,
                'user_id' => $userId,
                'payment_status_id' => PaymentStatus::COMPLETED->getId(),
                'amount_paid' => 0.00,
                'registered_at' => now(),
                'seed_number' => $userId,
            ]);

            echo "Added participant: {$user->name}\n";
        }
    }

    /**
     * Generate matches for a specific round
     */
    public function generateRoundMatches(int $championshipId, int $roundNumber): void
    {
        echo "Generating matches for Round {$roundNumber}...\n";

        $championship = Championship::find($championshipId);
        $participants = $championship->participants()->with('user')->get();

        if ($roundNumber == 1) {
            // Round 1: Simple pairing based on seed
            $pairings = [
                [$participants[0]->user_id, $participants[1]->user_id],
                // With 3 players, player 3 gets a bye in round 1
            ];

            foreach ($pairings as $index => $pairing) {
                [$player1Id, $player2Id] = $pairing;

                ChampionshipMatch::create([
                    'championship_id' => $championshipId,
                    'round_number' => $roundNumber,
                    'round_type' => ChampionshipRoundType::SWISS->value,
                    'player1_id' => $player1Id,
                    'player2_id' => $player2Id,
                    'white_player_id' => $player1Id,
                    'black_player_id' => $player2Id,
                    'status' => ChampionshipMatchStatus::PENDING->value,
                    'auto_generated' => true,
                    'scheduled_at' => now()->addHours($index * 2),
                    'deadline' => now()->addDays(1)->addHours($index * 2),
                ]);

                echo "  Match: User {$player1Id} vs User {$player2Id}\n";
            }

            // Handle bye for odd number of players
            if ($participants->count() % 2 == 1) {
                $byePlayer = $participants[2];
                echo "  Bye: User {$byePlayer->user_id} ({$byePlayer->user->name})\n";

                // Award bye point
                $this->updateStandings($championshipId, $byePlayer->user_id, 1.0, null, $roundNumber);
            }

        } else {
            // Subsequent rounds: Pair based on current standings
            $this->generateSwissPairings($championshipId, $roundNumber);
        }
    }

    /**
     * Generate Swiss system pairings for subsequent rounds
     */
    private function generateSwissPairings(int $championshipId, int $roundNumber): void
    {
        $standings = ChampionshipStanding::where('championship_id', $championshipId)
            ->orderBy('points', 'desc')
            ->orderBy('rank')
            ->get();

        $players = $standings->pluck('user_id')->toArray();

        // Simple Swiss pairing: 1 vs 2, 3 vs 4, etc.
        for ($i = 0; $i < count($players); $i += 2) {
            if (!isset($players[$i + 1])) {
                // Bye for odd player
                echo "  Bye: User {$players[$i]}\n";
                $this->updateStandings($championshipId, $players[$i], 1.0, null, $roundNumber);
                continue;
            }

            $player1Id = $players[$i];
            $player2Id = $players[$i + 1];

            // Alternate colors
            $whitePlayerId = ($roundNumber % 2 == 1) ? $player1Id : $player2Id;
            $blackPlayerId = ($roundNumber % 2 == 1) ? $player2Id : $player1Id;

            ChampionshipMatch::create([
                'championship_id' => $championshipId,
                'round_number' => $roundNumber,
                'round_type' => ChampionshipRoundType::SWISS->value,
                'player1_id' => $player1Id,
                'player2_id' => $player2Id,
                'white_player_id' => $whitePlayerId,
                'black_player_id' => $blackPlayerId,
                'status' => ChampionshipMatchStatus::PENDING->value,
                'auto_generated' => true,
                'scheduled_at' => now()->addHours(($roundNumber - 1) * 24),
                'deadline' => now()->addDays($roundNumber),
            ]);

            echo "  Match: User {$player1Id} vs User {$player2Id}\n";
        }
    }

    /**
     * Simulate completion of a specific round with desired results
     */
    public function simulateRoundProgress(int $championshipId, int $roundNumber, array $results = []): void
    {
        echo "Simulating Round {$roundNumber} completion...\n";

        $matches = ChampionshipMatch::where('championship_id', $championshipId)
            ->where('round_number', $roundNumber)
            ->where('status', '!=', ChampionshipMatchStatus::COMPLETED->value)
            ->get();

        if ($matches->isEmpty()) {
            echo "No pending matches found for Round {$roundNumber}\n";
            return;
        }

        // Default results if not provided
        if (empty($results)) {
            $results = $this->generateDefaultResults($matches, $roundNumber);
        }

        DB::beginTransaction();
        try {
            foreach ($matches as $index => $match) {
                $result = $results[$index] ?? 'win_white';

                $winnerId = null;
                $resultType = null;

                switch ($result) {
                    case 'win_white':
                        $winnerId = $match->white_player_id;
                        $resultType = ChampionshipResultType::COMPLETED->value;
                        break;
                    case 'win_black':
                        $winnerId = $match->black_player_id;
                        $resultType = ChampionshipResultType::COMPLETED->value;
                        break;
                    case 'draw':
                        $winnerId = null;
                        $resultType = ChampionshipResultType::DRAW->value;
                        break;
                }

                // Create a mock game
                $game = $this->createMockGame($match);

                // Update match
                $match->update([
                    'game_id' => $game->id,
                    'winner_id' => $winnerId,
                    'result_type' => $resultType,
                    'status' => ChampionshipMatchStatus::COMPLETED->value,
                ]);

                echo "  Match completed: {$match->whitePlayer->name} vs {$match->blackPlayer->name} - Result: {$result}\n";

                // Update standings
                $this->updateStandingsAfterMatch($championshipId, $match);
            }

            // Update championship current round
            $championship = Championship::find($championshipId);
            $championship->update(['current_round' => $roundNumber + 1]);

            // Generate next round matches
            if ($roundNumber < $championship->total_rounds) {
                $this->generateRoundMatches($championshipId, $roundNumber + 1);
            }

            DB::commit();
            echo "Round {$roundNumber} completed successfully!\n";

        } catch (\Exception $e) {
            DB::rollBack();
            echo "Error simulating round: " . $e->getMessage() . "\n";
            throw $e;
        }
    }

    /**
     * Generate default results for testing
     */
    private function generateDefaultResults($matches, int $roundNumber): array
    {
        $results = [];

        foreach ($matches as $index => $match) {
            // Create a predictable pattern for testing
            switch ($roundNumber % 3) {
                case 1:
                    $results[] = $index % 2 == 0 ? 'win_white' : 'win_black';
                    break;
                case 2:
                    $results[] = $index % 2 == 0 ? 'win_black' : 'draw';
                    break;
                default:
                    $results[] = $index % 3 == 0 ? 'draw' : ($index % 2 == 0 ? 'win_white' : 'win_black');
                    break;
            }
        }

        return $results;
    }

    /**
     * Create a mock game for testing
     */
    private function createMockGame(ChampionshipMatch $match): Game
    {
        $game = Game::create([
            'white_player_id' => $match->white_player_id,
            'black_player_id' => $match->black_player_id,
            'status' => 'completed',
            'result' => $match->result_type,
            'winner_id' => $match->winner_id,
            'created_at' => now(),
            'updated_at' => now(),
            'completed_at' => now(),
        ]);

        // Add some mock moves
        $moves = [
            ['from' => 'e2', 'to' => 'e4', 'piece' => 'P', 'notation' => 'e4'],
            ['from' => 'e7', 'to' => 'e5', 'piece' => 'P', 'notation' => 'e5'],
            ['from' => 'g1', 'to' => 'f3', 'piece' => 'N', 'notation' => 'Nf3'],
            ['from' => 'b8', 'to' => 'c6', 'piece' => 'N', 'notation' => 'Nc6'],
        ];

        // Simple starting board state as FEN
        $boardState = [
            'pieces' => [
                'a8' => 'bR', 'b8' => 'bN', 'c8' => 'bB', 'd8' => 'bQ', 'e8' => 'bK', 'f8' => 'bB', 'g8' => 'bN', 'h8' => 'bR',
                'a7' => 'bP', 'b7' => 'bP', 'c7' => 'bP', 'd7' => 'bP', 'e7' => 'bP', 'f7' => 'bP', 'g7' => 'bP', 'h7' => 'bP',
                'a2' => 'wP', 'b2' => 'wP', 'c2' => 'wP', 'd2' => 'wP', 'e2' => 'wP', 'f2' => 'wP', 'g2' => 'wP', 'h2' => 'wP',
                'a1' => 'wR', 'b1' => 'wN', 'c1' => 'wB', 'd1' => 'wQ', 'e1' => 'wK', 'f1' => 'wB', 'g1' => 'wN', 'h1' => 'wR'
            ],
            'turn' => 'white',
            'castling' => ['K', 'Q', 'k', 'q'],
            'en_passant' => null,
            'halfmove' => 0,
            'fullmove' => 1
        ];

        foreach ($moves as $index => $move) {
            GameMove::create([
                'game_id' => $game->id,
                'user_id' => $index % 2 == 0 ? $match->white_player_id : $match->black_player_id,
                'move_number' => $index + 1,
                'from_square' => $move['from'],
                'to_square' => $move['to'],
                'piece_moved' => $move['piece'],
                'move_notation' => $move['notation'],
                'board_state' => $boardState,
                'created_at' => now()->addSeconds($index * 10),
                'move_timestamp' => now()->addSeconds($index * 10),
            ]);
        }

        return $game;
    }

    /**
     * Update standings after a match
     */
    private function updateStandingsAfterMatch(int $championshipId, ChampionshipMatch $match): void
    {
        $whitePoints = 0;
        $blackPoints = 0;

        if ($match->winner_id) {
            // Someone won
            if ($match->winner_id === $match->white_player_id) {
                $whitePoints = 1.0;
                $blackPoints = 0.0;
            } else {
                $whitePoints = 0.0;
                $blackPoints = 1.0;
            }
        } elseif ($match->result_type === ChampionshipResultType::DRAW->value) {
            $whitePoints = 0.5;
            $blackPoints = 0.5;
        } else {
            $whitePoints = 0.0;
            $blackPoints = 0.0;
        }

        $this->updateStandings($championshipId, $match->white_player_id, $whitePoints, $match->result_type, $match->round_number);
        $this->updateStandings($championshipId, $match->black_player_id, $blackPoints, $match->result_type, $match->round_number);
    }

    /**
     * Update player standings
     */
    private function updateStandings(int $championshipId, int $userId, float $points, ?string $resultType, int $roundNumber): void
    {
        $standing = ChampionshipStanding::firstOrCreate(
            ['championship_id' => $championshipId, 'user_id' => $userId],
            [
                'rank' => 1,
                'points' => 0,
                'wins' => 0,
                'losses' => 0,
                'draws' => 0,
                'matches_played' => 0,
                'buchholz_score' => 0,
                'sonneborn_berger' => 0,
                            ]
        );

        if ($resultType && $resultType !== ChampionshipResultType::BYE->value) {
            if ($points == 1.0) {
                $standing->wins++;
            } elseif ($points == 0.5) {
                $standing->draws++;
            } else {
                $standing->losses++;
            }
            $standing->matches_played++;
        }

        $standing->points += $points;
        $standing->save();

        // Recalculate ranks
        $this->recalculateRanks($championshipId);
    }

    /**
     * Recalculate standings rankings
     */
    private function recalculateRanks(int $championshipId): void
    {
        $standings = ChampionshipStanding::where('championship_id', $championshipId)
            ->orderBy('points', 'desc')
            ->orderBy('wins', 'desc')
            ->get();

        foreach ($standings as $index => $standing) {
            $standing->rank = $index + 1;
            $standing->save();
        }
    }

    /**
     * Create championship at specific stage
     */
    public function createChampionshipAtStage(string $stage): Championship
    {
        echo "Creating championship at stage: {$stage}\n";

        $championship = $this->createTestChampionship();

        switch ($stage) {
            case 'registration':
                // Already in registration state
                break;

            case 'round1_pending':
                $championship->update(['status' => ChampionshipStatus::IN_PROGRESS->value]);
                break;

            case 'round1_completed':
                $championship->update(['status' => ChampionshipStatus::IN_PROGRESS->value]);
                $this->simulateRoundProgress($championship->id, 1);
                break;

            case 'round2_completed':
                $championship->update(['status' => ChampionshipStatus::IN_PROGRESS->value]);
                $this->simulateRoundProgress($championship->id, 1);
                $this->simulateRoundProgress($championship->id, 2);
                break;

            case 'completed':
                $championship->update(['status' => ChampionshipStatus::IN_PROGRESS->value]);
                for ($i = 1; $i <= $championship->total_rounds; $i++) {
                    $this->simulateRoundProgress($championship->id, $i);
                }
                $championship->update(['status' => ChampionshipStatus::COMPLETED->value]);
                break;
        }

        echo "Championship created at '{$stage}' stage\n";
        return $championship;
    }

    /**
     * Reset championship to initial state
     */
    public function resetChampionship(int $championshipId): void
    {
        echo "Resetting championship {$championshipId}...\n";

        DB::beginTransaction();
        try {
            // Delete matches, games, moves, standings
            $matches = ChampionshipMatch::where('championship_id', $championshipId)->get();

            foreach ($matches as $match) {
                if ($match->game) {
                    $match->game->moves()->delete();
                    $match->game->delete();
                }
                $match->delete();
            }

            ChampionshipStanding::where('championship_id', $championshipId)->delete();

            // Reset championship
            $championship = Championship::find($championshipId);
            $championship->update([
                'status' => ChampionshipStatus::REGISTRATION_OPEN->value,
                'current_round' => 0,
            ]);

            // Regenerate round 1 matches
            $this->generateRoundMatches($championshipId, 1);

            DB::commit();
            echo "Championship reset successfully!\n";

        } catch (\Exception $e) {
            DB::rollBack();
            echo "Error resetting championship: " . $e->getMessage() . "\n";
            throw $e;
        }
    }

    /**
     * Analyze current championship state
     */
    public function analyzeChampionship(int $championshipId): void
    {
        echo "\n=== Championship Analysis ===\n";

        $championship = Championship::with(['participants.user', 'matches.whitePlayer', 'matches.blackPlayer', 'standings.user'])
            ->find($championshipId);

        if (!$championship) {
            echo "Championship {$championshipId} not found\n";
            return;
        }

        echo "Title: {$championship->title}\n";
        echo "Status: {$championship->status}\n";
        echo "Format: {$championship->format}\n";
        echo "Current Round: {$championship->current_round} / {$championship->total_rounds}\n";
        echo "Participants: {$championship->registered_count}\n\n";

        // Participants
        echo "Participants:\n";
        foreach ($championship->participants as $participant) {
            echo "  - {$participant->user->name} (ID: {$participant->user_id})\n";
        }

        // Matches by round
        echo "\nMatches by Round:\n";
        for ($i = 1; $i <= $championship->total_rounds; $i++) {
            $matches = $championship->matches->where('round_number', $i);
            $completed = $matches->where('status', 'completed')->count();
            $total = $matches->count();
            echo "  Round {$i}: {$completed}/{$total} completed\n";
        }

        // Current standings
        echo "\nCurrent Standings:\n";
        foreach ($championship->standings->sortBy('rank') as $standing) {
            echo "  {$standing->rank}. {$standing->user->name}: {$standing->points} points (W:{$standing->wins} L:{$standing->losses} D:{$standing->draws})\n";
        }
    }

    /**
     * List all test championships
     */
    public function listTestChampionships(): void
    {
        echo "\n=== Test Championships ===\n";

        $championships = Championship::where('title', 'like', 'Test Championship%')
            ->orWhere('title', 'like', '%test%')
            ->orderBy('created_at', 'desc')
            ->get();

        foreach ($championships as $champ) {
            echo "ID: {$champ->id} - {$champ->title} ({$champ->status}) - {$champ->registered_count} participants\n";
        }
    }
}