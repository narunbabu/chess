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
    private function expiredMatchWithGame(callable $gameAttributes, string $format = 'swiss_only'): array
    {
        Queue::fake();

        $p1 = User::factory()->create();
        $p2 = User::factory()->create();

        $championship = Championship::factory()->create(['format' => $format]);

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

    public function test_dropped_player_is_recorded_as_dropped_on_the_participant_row(): void
    {
        // update(['dropped' => true]) hit no column and was discarded, so the
        // player could still be paired into later rounds.
        [$match, $p1, $p2, $p3] = $this->championshipWithSecondForfeit();

        (new CheckExpiredMatchesJob())->handle();

        $participant = $match->championship->participants()
            ->where('user_id', $p2->id)
            ->first();

        $this->assertTrue($participant->isDropped());
        $this->assertSame('forfeit_limit', $participant->dropped_reason);
        $this->assertSame(
            0,
            $match->championship->participants()->notDropped()->where('user_id', $p2->id)->count()
        );
        // The players who are still in are untouched.
        $this->assertSame(
            2,
            $match->championship->participants()->notDropped()->count()
        );
    }

    public function test_remaining_match_with_the_dropped_player_as_player2_records_forfeit_player2(): void
    {
        // The drop loop always wrote FORFEIT_PLAYER1, which contradicted
        // winner_id and scored the match against the wrong side whenever the
        // dropped player was player2.
        [$match, $p1, $p2, $p3, $remaining] = $this->championshipWithSecondForfeit(droppedPlayerIsPlayer1: false);

        (new CheckExpiredMatchesJob())->handle();

        $remaining->refresh();
        $this->assertSame('completed', $remaining->status);
        $this->assertSame($p3->id, (int) $remaining->player1_id);
        $this->assertSame($p3->id, (int) $remaining->winner_id);
        $this->assertSame(
            ChampionshipResultType::FORFEIT_PLAYER2->getId(),
            (int) $remaining->result_type_id
        );
    }

    public function test_standings_credit_the_opponent_not_the_dropped_player(): void
    {
        // StandingsCalculatorService::getMatchResult() reads result_type, not
        // winner_id: with the old always-FORFEIT_PLAYER1 write, a drop-forfeited
        // match where the dropped player was player2 handed the WIN to the
        // dropped player and a LOSS to their opponent.
        [$match, $p1, $p2, $p3, $remaining] = $this->championshipWithSecondForfeit(droppedPlayerIsPlayer1: false);

        (new CheckExpiredMatchesJob())->handle();
        (new StandingsCalculatorService())->updateStandings($match->championship->fresh());

        $droppedStanding = ChampionshipStanding::where('championship_id', $match->championship_id)
            ->where('user_id', $p2->id)->first();
        $opponentStanding = ChampionshipStanding::where('championship_id', $match->championship_id)
            ->where('user_id', $p3->id)->first();

        $this->assertSame(0, (int) $droppedStanding->wins);
        $this->assertSame(2, (int) $opponentStanding->wins, 'both of p2\'s forfeits are wins for p3');
    }

    public function test_remaining_bye_row_of_a_dropped_player_has_no_winner(): void
    {
        [$match, $p1, $p2] = $this->championshipWithSecondForfeit();

        $bye = ChampionshipMatch::factory()->create([
            'championship_id' => $match->championship_id,
            'round_number' => 3,
            'player1_id' => $p2->id,
            'player2_id' => null,
            'status' => 'pending',
            'deadline' => now()->addDays(2),
        ]);

        (new CheckExpiredMatchesJob())->handle();

        $bye->refresh();
        $this->assertSame('completed', $bye->status);
        $this->assertNull($bye->winner_id);
        $this->assertSame(
            ChampionshipResultType::FORFEIT_PLAYER1->getId(),
            (int) $bye->result_type_id
        );
    }

    public function test_the_drop_records_the_dropped_players_loss_not_only_the_opponents_win(): void
    {
        // The drop loop credited the opponent a win and stopped there, so the
        // dropped player's own record never moved: their remaining matches
        // vanished from losses and matches_played.
        //
        // Elimination format on purpose: a Swiss championship recalculates the
        // whole table from the match rows (updateStandingsAfterForfeit), which
        // masks the missing increment. Outside Swiss these increments are the
        // only standings record there is.
        [$match, $p1, $p2, $p3, $remaining] = $this->championshipWithSecondForfeit(
            format: 'elimination_only'
        );

        (new CheckExpiredMatchesJob())->handle();

        $dropped = ChampionshipStanding::where('championship_id', $match->championship_id)
            ->where('user_id', $p2->id)->first();
        $opponent = ChampionshipStanding::where('championship_id', $match->championship_id)
            ->where('user_id', $p3->id)->first();

        $this->assertNotNull($dropped, 'the dropped player must have a standing row');
        // Two losses: the expired match that triggered the drop, and the
        // pending match the drop forfeited.
        $this->assertSame(2, (int) $dropped->losses);
        $this->assertSame(0, (int) $dropped->wins);
        $this->assertSame(2, (int) $dropped->matches_played);

        $this->assertSame(1, (int) $opponent->wins);
        $this->assertSame(1, (int) $opponent->matches_played);
    }

    public function test_a_forfeited_bye_row_still_counts_as_a_loss_for_the_dropped_player(): void
    {
        [$match, $p1, $p2] = $this->championshipWithSecondForfeit(format: 'elimination_only');

        ChampionshipMatch::factory()->create([
            'championship_id' => $match->championship_id,
            'round_number' => 3,
            'player1_id' => $p2->id,
            'player2_id' => null,
            'status' => 'pending',
            'deadline' => now()->addDays(2),
        ]);

        (new CheckExpiredMatchesJob())->handle();

        $dropped = ChampionshipStanding::where('championship_id', $match->championship_id)
            ->where('user_id', $p2->id)->first();

        // Expired match + remaining match + bye row.
        $this->assertSame(3, (int) $dropped->losses);
        $this->assertSame(3, (int) $dropped->matches_played);
    }

    /**
     * An expired match that makes p2's second forfeit, plus one pending match
     * between p2 and p3 that the drop must resolve.
     *
     * @return array{0: ChampionshipMatch, 1: User, 2: User, 3: User, 4: ChampionshipMatch}
     */
    private function championshipWithSecondForfeit(
        bool $droppedPlayerIsPlayer1 = true,
        string $format = 'swiss_only'
    ): array {
        [$match, $p1, $p2] = $this->expiredMatchWithGame(fn (User $p1, User $p2) => [
            'moves' => [['san' => 'e4', 'user_id' => $p1->id]],
            'turn' => 'black',
            'last_move_at' => now()->subMinutes(10),
        ], $format);

        $championship = $match->championship;
        $p3 = User::factory()->create();

        foreach ([$p1, $p2, $p3] as $player) {
            ChampionshipParticipant::create([
                'championship_id' => $championship->id,
                'user_id' => $player->id,
                'payment_status' => 'completed',
                'registration_status' => 'registered',
                'amount_paid' => 0,
                'registered_at' => now(),
            ]);
        }

        // p2's first forfeit.
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
            'player1_id' => $droppedPlayerIsPlayer1 ? $p2->id : $p3->id,
            'player2_id' => $droppedPlayerIsPlayer1 ? $p3->id : $p2->id,
            'status' => 'pending',
            'deadline' => now()->addDay(),
        ]);

        return [$match, $p1, $p2, $p3, $remaining];
    }
}
