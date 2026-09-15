<?php

namespace Tests\Feature;

use App\Enums\ChampionshipResultType;
use App\Jobs\CheckExpiredMatchesJob;
use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipParticipant;
use App\Models\ChampionshipStanding;
use App\Models\Game;
use App\Models\User;
use App\Services\StandingsCalculatorService;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * CheckExpiredMatchesJob decided forfeits via $game->moves()->latest(), but
 * moves is a JSON array column on games, not a relation. Every expired match
 * with a game threw inside the per-match try/catch and stayed unresolved.
 * These tests pin the forfeit decision read from games.moves / last_move_at.
 */
class CheckExpiredMatchesJobTest extends TestCase
{
    private function expiredMatchWithGame(callable $gameAttributes): array
    {
        Queue::fake();

        $p1 = User::factory()->create();
        $p2 = User::factory()->create();

        $championship = Championship::factory()->create(['format' => 'swiss_only']);

        $game = Game::factory()->create(array_merge([
            'white_player_id' => $p1->id,
            'black_player_id' => $p2->id,
            'status' => 'active',
        ], $gameAttributes($p1, $p2)));

        $match = ChampionshipMatch::factory()->create([
            'championship_id' => $championship->id,
            'player1_id' => $p1->id,
            'player2_id' => $p2->id,
            'status' => 'in_progress',
            'deadline' => now()->subHour(),
        ]);
        $match->game_id = $game->id;
        $match->save();

        return [$match, $p1, $p2];
    }

    private function assertForfeit(ChampionshipMatch $match, ChampionshipResultType $type, ?int $winnerId): void
    {
        $match->refresh();
        $this->assertSame('completed', $match->status);
        $this->assertSame($type->getId(), (int) $match->result_type_id);
        $this->assertSame($winnerId, $match->winner_id === null ? null : (int) $match->winner_id);
    }

    public function test_recent_last_move_by_player1_forfeits_player2(): void
    {
        [$match, $p1, $p2] = $this->expiredMatchWithGame(fn (User $p1, User $p2) => [
            'moves' => [
                ['san' => 'e4', 'user_id' => $p1->id],
                ['san' => 'e5', 'user_id' => $p2->id],
                ['san' => 'Nf3', 'user_id' => $p1->id],
            ],
            'turn' => 'black',
            'last_move_at' => now()->subMinutes(10),
        ]);

        (new CheckExpiredMatchesJob())->handle();

        $this->assertForfeit($match, ChampionshipResultType::FORFEIT_PLAYER2, $p1->id);
    }

    public function test_recent_last_move_by_player2_forfeits_player1(): void
    {
        [$match, $p1, $p2] = $this->expiredMatchWithGame(fn (User $p1, User $p2) => [
            'moves' => [
                ['san' => 'e4', 'user_id' => $p1->id],
                ['san' => 'e5', 'user_id' => $p2->id],
            ],
            'turn' => 'white',
            'last_move_at' => now()->subMinutes(10),
        ]);

        (new CheckExpiredMatchesJob())->handle();

        $this->assertForfeit($match, ChampionshipResultType::FORFEIT_PLAYER1, $p2->id);
    }

    public function test_stale_last_move_is_double_forfeit(): void
    {
        [$match, $p1] = $this->expiredMatchWithGame(fn (User $p1, User $p2) => [
            'moves' => [['san' => 'e4', 'user_id' => $p1->id]],
            'turn' => 'black',
            'last_move_at' => now()->subHours(3),
        ]);

        (new CheckExpiredMatchesJob())->handle();

        $this->assertForfeit($match, ChampionshipResultType::DOUBLE_FORFEIT, null);
    }

    public function test_legacy_move_without_user_id_uses_side_not_on_turn(): void
    {
        [$match, $p1] = $this->expiredMatchWithGame(fn (User $p1, User $p2) => [
            'moves' => ['e4'],
            'turn' => 'black',
            'last_move_at' => now()->subMinutes(10),
        ]);

        (new CheckExpiredMatchesJob())->handle();

        // White (player1) moved last, so player2 forfeits.
        $this->assertForfeit($match, ChampionshipResultType::FORFEIT_PLAYER2, $p1->id);
    }

    public function test_game_without_moves_and_both_players_seated_is_double_forfeit(): void
    {
        // games.black_player_id is NOT NULL, so the creator rule's "opponent
        // never joined" branch cannot match and falls through to double forfeit.
        [$match] = $this->expiredMatchWithGame(fn (User $p1, User $p2) => [
            'moves' => [],
            'status' => 'waiting',
        ]);

        (new CheckExpiredMatchesJob())->handle();

        $this->assertForfeit($match, ChampionshipResultType::DOUBLE_FORFEIT, null);
    }

    public function test_second_forfeit_forfeits_the_players_remaining_matches(): void
    {
        // The forfeit count filtered on a nonexistent 'result_type' column: MySQL
        // threw (rolling back every forfeit) and SQLite always counted 0.
        [$match, $p1, $p2] = $this->expiredMatchWithGame(fn (User $p1, User $p2) => [
            'moves' => [['san' => 'e4', 'user_id' => $p1->id]],
            'turn' => 'black',
            'last_move_at' => now()->subMinutes(10),
        ]);
        $championship = $match->championship;
        $p3 = User::factory()->create();
        $championship->participantUsers()->attach([$p1->id, $p2->id, $p3->id]);

        ChampionshipMatch::factory()->create([
            'championship_id' => $championship->id,
            'player1_id' => $p3->id,
            'player2_id' => $p2->id,
            'status' => 'completed',
            'result_type' => ChampionshipResultType::FORFEIT_PLAYER2->value,
            'winner_id' => $p3->id,
            'deadline' => now()->subDays(2),
        ]);
        $remaining = ChampionshipMatch::factory()->create([
            'championship_id' => $championship->id,
            'round_number' => 2,
            'player1_id' => $p2->id,
            'player2_id' => $p3->id,
            'status' => 'pending',
            'deadline' => now()->addDay(),
        ]);

        (new CheckExpiredMatchesJob())->handle();

        $this->assertForfeit($match, ChampionshipResultType::FORFEIT_PLAYER2, $p1->id);
        $remaining->refresh();
        $this->assertSame('completed', $remaining->status);
        $this->assertSame($p3->id, (int) $remaining->winner_id);
        // The dropped player is player1 of the remaining match, so the side that
        // forfeited is player1.
        $this->assertSame(
            ChampionshipResultType::FORFEIT_PLAYER1->getId(),
            (int) $remaining->result_type_id
        );
    }
}
