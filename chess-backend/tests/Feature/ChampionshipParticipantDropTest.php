<?php

namespace Tests\Feature;

use App\Models\Championship;
use App\Models\ChampionshipParticipant;
use App\Models\ChampionshipStanding;
use App\Models\User;
use App\Jobs\GenerateNextRoundJob;
use App\Services\EliminationBracketService;
use App\Services\MatchSchedulerService;
use App\Services\SwissPairingService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * CheckExpiredMatchesJob wrote update(['dropped' => true]) against a column
 * championship_participants never had, so Eloquent discarded it and a player
 * dropped for repeated forfeits stayed pairable. The state now lives in
 * dropped_at / dropped_reason (2026_09_15 migration), with `dropped` kept as a
 * boolean alias, and pairing excludes dropped players.
 */
class ChampionshipParticipantDropTest extends TestCase
{
    private function participant(Championship $championship, User $user, array $attributes = []): ChampionshipParticipant
    {
        return ChampionshipParticipant::create(array_merge([
            'championship_id' => $championship->id,
            'user_id' => $user->id,
            'payment_status' => 'completed',
            'registration_status' => 'registered',
            'amount_paid' => 0,
            'registered_at' => now(),
        ], $attributes));
    }

    public function test_dropped_alias_writes_a_timestamp_and_reads_back_as_bool(): void
    {
        $championship = Championship::factory()->create();
        $participant = $this->participant($championship, User::factory()->create());

        $this->assertFalse($participant->dropped);
        $this->assertNull($participant->dropped_at);

        $participant->update(['dropped' => true]);
        $participant->refresh();

        $this->assertTrue($participant->dropped);
        $this->assertNotNull($participant->dropped_at);
        $this->assertDatabaseHas('championship_participants', ['id' => $participant->id]);
        $this->assertNotNull(
            ChampionshipParticipant::find($participant->id)->dropped_at,
            'dropped must persist to a real column, not be silently discarded'
        );

        $participant->update(['dropped' => false]);
        $participant->refresh();

        $this->assertFalse($participant->dropped);
        $this->assertNull($participant->dropped_at);
    }

    public function test_mark_as_dropped_keeps_the_first_stamp_and_reason(): void
    {
        $championship = Championship::factory()->create();
        $participant = $this->participant($championship, User::factory()->create());

        $this->travelTo(now()->subHour());
        $participant->markAsDropped('forfeit_limit');
        $firstStamp = $participant->fresh()->dropped_at;
        $this->travelBack();

        $participant->markAsDropped('something_else');
        $participant->refresh();

        $this->assertTrue($participant->isDropped());
        $this->assertSame('forfeit_limit', $participant->dropped_reason);
        $this->assertSame($firstStamp->toDateTimeString(), $participant->dropped_at->toDateTimeString());
    }

    public function test_dropping_does_not_touch_registration_or_payment_state(): void
    {
        $championship = Championship::factory()->create();
        $participant = $this->participant($championship, User::factory()->create());

        $participant->markAsDropped('forfeit_limit');
        $participant->refresh();

        // A dropped player stays a registered, paid participant: refunds still
        // see the payment history, and active_unique_key stays set so they
        // cannot simply re-register into the championship they were dropped from.
        $this->assertSame('registered', $participant->registration_status);
        $this->assertSame('completed', $participant->payment_status);
        $this->assertSame($participant->user_id, (int) $participant->active_unique_key);
        $this->assertTrue($championship->isUserRegistered($participant->user_id));
    }

    public function test_scopes_split_dropped_from_still_playing(): void
    {
        $championship = Championship::factory()->create();
        $stillIn = $this->participant($championship, User::factory()->create());
        $dropped = $this->participant($championship, User::factory()->create());
        $dropped->markAsDropped('forfeit_limit');

        $this->assertSame([$stillIn->id], $championship->participants()->notDropped()->pluck('id')->all());
        $this->assertSame([$dropped->id], $championship->participants()->dropped()->pluck('id')->all());
    }

    public function test_dropped_player_is_not_paired_in_a_swiss_round(): void
    {
        $championship = Championship::factory()->create(['format' => 'swiss_only']);

        $users = User::factory()->count(5)->create();
        foreach ($users as $user) {
            $this->participant($championship, $user);
        }

        $droppedUser = $users->first();
        $championship->participants()->where('user_id', $droppedUser->id)->first()
            ->markAsDropped('forfeit_limit');

        $pairings = (new SwissPairingService())->generatePairings($championship->fresh(), 1);

        $pairedIds = collect($pairings)
            ->flatMap(fn ($pairing) => [$pairing['player1_id'] ?? null, $pairing['player2_id'] ?? null])
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->all();

        $this->assertNotContains($droppedUser->id, $pairedIds);
        $this->assertCount(4, array_unique($pairedIds), 'the other four players must still be paired');
    }

    public function test_dropped_player_is_not_paired_in_a_test_tournament(): void
    {
        // Test tournaments bypass the payment filter entirely - the drop must
        // still apply on that path.
        $championship = Championship::factory()->create([
            'format' => 'swiss_only',
            'is_test_tournament' => true,
        ]);

        $users = User::factory()->count(3)->create();
        foreach ($users as $user) {
            $this->participant($championship, $user, ['payment_status' => 'pending']);
        }

        $droppedUser = $users->first();
        $championship->participants()->where('user_id', $droppedUser->id)->first()
            ->markAsDropped('forfeit_limit');

        $pairings = (new SwissPairingService())->generatePairings($championship->fresh(), 1);

        $pairedIds = collect($pairings)
            ->flatMap(fn ($pairing) => [$pairing['player1_id'] ?? null, $pairing['player2_id'] ?? null])
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->all();

        $this->assertNotContains($droppedUser->id, $pairedIds);
    }

    public function test_dropped_player_is_not_eligible_for_an_elimination_bracket(): void
    {
        $championship = Championship::factory()->create(['format' => 'elimination_only']);

        $users = User::factory()->count(4)->create();
        foreach ($users as $user) {
            $this->participant($championship, $user);
        }

        $droppedUser = $users->first();
        $championship->participants()->where('user_id', $droppedUser->id)->first()
            ->markAsDropped('forfeit_limit');

        $pairings = (new EliminationBracketService())
            ->generateEliminationPairings($championship->fresh(), 1);
        $pairedIds = collect($pairings)
            ->flatMap(fn (array $pairing) => [$pairing['player1_id'], $pairing['player2_id']])
            ->filter()
            ->all();

        $this->assertNotContains($droppedUser->id, $pairedIds);
        $this->assertCount(3, array_unique($pairedIds));
    }

    public function test_dropped_player_does_not_qualify_from_the_swiss_stage_of_a_hybrid(): void
    {
        // Hybrid brackets are seeded from standings, which still hold a dropped
        // player's Swiss score.
        $championship = Championship::factory()->create([
            'format' => 'hybrid',
            'top_qualifiers' => 2,
        ]);

        $users = User::factory()->count(3)->create();
        $points = [5, 3, 1];
        foreach ($users as $index => $user) {
            $this->participant($championship, $user);
            ChampionshipStanding::create([
                'championship_id' => $championship->id,
                'user_id' => $user->id,
                'points' => $points[$index],
                'matches_played' => 3,
                'wins' => 0,
                'draws' => 0,
                'losses' => 0,
            ]);
        }

        $topScorer = $users->first();
        $championship->participants()->where('user_id', $topScorer->id)->first()
            ->markAsDropped('forfeit_limit');

        $eligible = $this->eligibleForElimination($championship->fresh());
        $eligibleIds = $eligible->pluck('user_id')->map(fn ($id) => (int) $id)->all();

        $this->assertNotContains($topScorer->id, $eligibleIds);
        $this->assertSame([$users[1]->id, $users[2]->id], $eligibleIds);
    }

    public function test_a_dropped_player_does_not_count_towards_having_enough_participants(): void
    {
        // Two paid players, one of them dropped: only one can actually be
        // paired, so the round must not be generated.
        $championship = Championship::factory()->create(['format' => 'swiss_only']);

        $users = User::factory()->count(2)->create();
        foreach ($users as $user) {
            $this->participant($championship, $user);
        }

        $job = new GenerateNextRoundJob($championship->fresh());
        $this->assertTrue($this->callPrivate($job, 'hasEnoughParticipants'));

        $championship->participants()->where('user_id', $users->first()->id)->first()
            ->markAsDropped('forfeit_limit');

        $job = new GenerateNextRoundJob($championship->fresh());
        $this->assertFalse($this->callPrivate($job, 'hasEnoughParticipants'));
    }

    public function test_a_dropped_player_does_not_keep_an_elimination_bracket_running(): void
    {
        $championship = Championship::factory()->create(['format' => 'elimination_only']);

        $users = User::factory()->count(2)->create();
        foreach ($users as $user) {
            $this->participant($championship, $user);
        }

        $scheduler = new MatchSchedulerService();
        $this->assertFalse($this->callPrivate($scheduler, 'hasEliminationWinner', $championship->fresh()));
        $this->assertFalse(
            $this->callPrivate(new GenerateNextRoundJob($championship->fresh()), 'hasEliminationWinner')
        );

        $championship->participants()->where('user_id', $users->first()->id)->first()
            ->markAsDropped('forfeit_limit');

        // One player left standing is a finished bracket, not an endless one.
        $this->assertTrue($this->callPrivate($scheduler, 'hasEliminationWinner', $championship->fresh()));
        $this->assertTrue(
            $this->callPrivate(new GenerateNextRoundJob($championship->fresh()), 'hasEliminationWinner')
        );
    }

    public function test_auto_scheduling_completes_an_elimination_bracket_after_a_drop(): void
    {
        $championship = Championship::factory()->create([
            'format' => 'elimination_only',
            'status' => 'in_progress',
            'start_date' => now()->subHour(),
        ]);

        $users = User::factory()->count(2)->create();
        foreach ($users as $user) {
            $this->participant($championship, $user);
        }

        $championship->participants()->where('user_id', $users->first()->id)->first()
            ->markAsDropped('forfeit_limit');

        $this->assertNull((new MatchSchedulerService())->autoScheduleNextRound($championship->fresh()));
        $this->assertSame('completed', $championship->fresh()->status);
    }

    public function test_time_window_scheduling_refuses_a_round_that_only_dropped_players_could_fill(): void
    {
        $championship = Championship::factory()->create(['format' => 'swiss_only']);

        $users = User::factory()->count(2)->create();
        foreach ($users as $user) {
            $this->participant($championship, $user);
        }

        $championship->participants()->where('user_id', $users->first()->id)->first()
            ->markAsDropped('forfeit_limit');

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Not enough participants for scheduling');

        (new MatchSchedulerService())->scheduleMatchesWithTimeWindows(
            $championship->fresh(),
            1,
            now(),
            now()->addHours(4)
        );
    }

    public function test_the_participants_endpoint_surfaces_the_drop(): void
    {
        $championship = Championship::factory()->create();

        $users = User::factory()->count(3)->create();
        foreach ($users as $user) {
            $this->participant($championship, $user);
        }

        $dropped = $championship->participants()->where('user_id', $users->first()->id)->first();
        $dropped->markAsDropped('forfeit_limit');

        $response = $this->actingAs($users[1], 'sanctum')
            ->getJson("/api/v1/championships/{$championship->id}/participants")
            ->assertOk()
            ->assertJsonPath('total_participants', 3)
            ->assertJsonPath('active_participants', 2)
            ->assertJsonPath('dropped_participants', 1);

        $payload = collect($response->json('participants'))
            ->firstWhere('user_id', $users->first()->id);

        $this->assertTrue($payload['dropped']);
        $this->assertNotNull($payload['dropped_at']);
        $this->assertSame('forfeit_limit', $payload['dropped_reason']);

        $stillIn = collect($response->json('participants'))
            ->firstWhere('user_id', $users[1]->id);
        $this->assertFalse($stillIn['dropped']);
    }

    public function test_the_migration_is_reversible_and_re_runnable(): void
    {
        $migration = require base_path(
            'database/migrations/2026_09_15_000000_add_dropped_to_championship_participants.php'
        );

        $migration->down();
        $this->assertFalse(Schema::hasColumn('championship_participants', 'dropped_at'));
        $this->assertFalse(Schema::hasColumn('championship_participants', 'dropped_reason'));

        $migration->up();
        $this->assertTrue(Schema::hasColumn('championship_participants', 'dropped_at'));
        $this->assertTrue(Schema::hasColumn('championship_participants', 'dropped_reason'));
        $this->assertTrue(Schema::hasIndex('championship_participants', 'cp_championship_dropped_idx'));

        // A second up() must not try to recreate the named index.
        $migration->up();
        $this->assertTrue(Schema::hasIndex('championship_participants', 'cp_championship_dropped_idx'));
    }

    private function callPrivate(object $target, string $method, ...$arguments)
    {
        $reflection = new \ReflectionMethod($target, $method);
        $reflection->setAccessible(true);

        return $reflection->invoke($target, ...$arguments);
    }

    private function eligibleForElimination(Championship $championship): Collection
    {
        $service = new EliminationBracketService();
        $method = new \ReflectionMethod($service, 'getEligibleParticipants');
        $method->setAccessible(true);

        return $method->invoke($service, $championship);
    }
}
