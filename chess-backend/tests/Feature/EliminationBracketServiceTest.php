<?php

namespace Tests\Feature;

use App\Enums\ChampionshipMatchStatus;
use App\Enums\ChampionshipRoundType;
use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipParticipant;
use App\Models\User;
use App\Services\EliminationBracketService;
use Tests\TestCase;

class EliminationBracketServiceTest extends TestCase
{
    public function test_first_round_pairings_use_the_generic_elimination_round_type(): void
    {
        $championship = Championship::factory()->create([
            'format' => 'elimination_only',
            'match_time_window_hours' => 4,
        ]);
        $users = User::factory()->count(4)->create();

        foreach ($users as $user) {
            $this->participant($championship, $user);
        }

        $pairings = (new EliminationBracketService())
            ->generateEliminationPairings($championship->fresh(), 1);

        $this->assertCount(2, $pairings);
        $this->assertSame(
            [ChampionshipRoundType::ELIMINATION, ChampionshipRoundType::ELIMINATION],
            array_column($pairings, 'round_type')
        );
        $this->assertSame(
            $users->pluck('id')->sort()->values()->all(),
            collect($pairings)
                ->flatMap(fn (array $pairing) => [$pairing['player1_id'], $pairing['player2_id']])
                ->sort()
                ->values()
                ->all()
        );
    }

    public function test_first_round_matches_persist_with_the_elimination_lookup_row(): void
    {
        $championship = Championship::factory()->create([
            'format' => 'elimination_only',
            'match_time_window_hours' => 4,
        ]);
        $users = User::factory()->count(4)->create();

        foreach ($users as $user) {
            $this->participant($championship, $user);
        }

        $matches = (new EliminationBracketService())
            ->generateBracketRound($championship->fresh(), 1);

        $this->assertCount(2, $matches);
        $this->assertSame(
            [ChampionshipRoundType::ELIMINATION->value, ChampionshipRoundType::ELIMINATION->value],
            $matches->pluck('round_type')->all()
        );
        $this->assertSame(
            ChampionshipRoundType::ELIMINATION->getId(),
            $matches->first()->round_type_id
        );
    }

    public function test_subsequent_round_pairs_completed_elimination_winners(): void
    {
        $championship = Championship::factory()->create([
            'format' => 'elimination_only',
            'match_time_window_hours' => 4,
        ]);
        $users = User::factory()->count(4)->create();

        foreach ($users as $user) {
            $this->participant($championship, $user);
        }

        $service = new EliminationBracketService();
        $firstRound = $service->generateBracketRound($championship->fresh(), 1);
        $winners = $firstRound->pluck('player1_id')->values();

        $firstRound->each(function (ChampionshipMatch $match, int $index) use ($winners): void {
            $match->update([
                'winner_id' => $winners[$index],
                'status' => ChampionshipMatchStatus::COMPLETED,
            ]);
        });

        $pairings = $service->generateEliminationPairings($championship->fresh(), 2);

        $this->assertCount(1, $pairings);
        $this->assertSame(ChampionshipRoundType::ELIMINATION, $pairings[0]['round_type']);
        $this->assertSame($winners->sort()->values()->all(), collect([
            $pairings[0]['player1_id'],
            $pairings[0]['player2_id'],
        ])->sort()->values()->all());
    }

    private function participant(Championship $championship, User $user): ChampionshipParticipant
    {
        return ChampionshipParticipant::create([
            'championship_id' => $championship->id,
            'user_id' => $user->id,
            'payment_status' => 'completed',
            'registration_status' => 'registered',
            'amount_paid' => 0,
            'registered_at' => now(),
        ]);
    }
}
