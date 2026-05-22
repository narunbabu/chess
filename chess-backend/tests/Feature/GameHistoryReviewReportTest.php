<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\GameHistory;
use App\Models\User;
use App\Models\UserMoveReviewStats;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GameHistoryReviewReportTest extends TestCase
{
    private function reportPayload(array $overrides = []): array
    {
        return array_merge([
            'played_at' => '2026-05-17 12:00:00',
            'player_color' => 'w',
            'computer_level' => 4,
            'moves' => 'e4,1.00;e5,1.00',
            'final_score' => 2.5,
            'opponent_score' => 1.5,
            'result' => [
                'status' => 'won',
                'winner' => 'player',
                'details' => 'Checkmate',
            ],
            'game_mode' => 'computer',
            'review_report' => [
                'version' => 1,
                'moves' => [
                    [
                        'ply' => 1,
                        'san' => 'e4',
                        'userMoveRank' => 2,
                        'topMoves' => [
                            ['rank' => 1, 'move' => 'd2d4', 'san' => 'd4', 'cp' => 34],
                            ['rank' => 2, 'move' => 'e2e4', 'san' => 'e4', 'cp' => 29],
                        ],
                    ],
                ],
            ],
            'review_summary' => [
                'analyzed_moves' => 1,
                'best_move_count' => 0,
                'top_1_count' => 0,
                'top_2_count' => 1,
                'top_3_count' => 0,
                'average_rank' => 2,
                'ranked_moves_count' => 1,
                'rank_sum' => 2,
                'outside_top_moves_count' => 0,
                'outside_top_5_count' => 0,
                'coins_earned' => 2,
            ],
            'best_button_uses' => 2,
            'review_enabled_used' => true,
        ], $overrides);
    }

    public function test_authenticated_game_history_stores_review_report_fields(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/game-history', $this->reportPayload());

        $response->assertCreated()
            ->assertJsonPath('data.best_button_uses', 2)
            ->assertJsonPath('data.review_enabled_used', true)
            ->assertJsonPath('data.review_summary.analyzed_moves', 1)
            ->assertJsonPath('data.review_report.moves.0.userMoveRank', 2);

        $history = GameHistory::query()->where('user_id', $user->id)->firstOrFail();

        $this->assertSame(2, $history->best_button_uses);
        $this->assertTrue($history->review_enabled_used);
        $this->assertSame(1, $history->review_summary['analyzed_moves']);
        $this->assertSame(1, $history->review_summary['top_2_count']);
        $this->assertSame(2, $history->review_summary['coins_earned']);
        $this->assertSame(2, $history->review_report['moves'][0]['userMoveRank']);

        $stats = UserMoveReviewStats::query()->where('user_id', $user->id)->firstOrFail();
        $this->assertSame(1, $stats->games_analyzed);
        $this->assertSame(1, $stats->analyzed_moves);
        $this->assertSame(1, $stats->top_2_count);
        $this->assertSame(2, $stats->best_button_uses);
        $this->assertSame(2, $stats->coins_earned);

        $detail = $this->getJson("/api/v1/game-history/{$history->id}");

        $detail->assertOk()
            ->assertJsonPath('data.best_button_uses', 2)
            ->assertJsonPath('data.review_summary.analyzed_moves', 1);
    }

    public function test_existing_multiplayer_history_can_be_updated_with_review_report(): void
    {
        $white = User::factory()->create();
        $black = User::factory()->create();
        $game = Game::factory()->create([
            'white_player_id' => $white->id,
            'black_player_id' => $black->id,
            'status' => 'active',
        ]);

        $existing = GameHistory::create([
            'user_id' => $white->id,
            'game_id' => $game->id,
            'played_at' => now(),
            'player_color' => 'w',
            'computer_level' => 0,
            'moves' => 'e4,1.00',
            'final_score' => 1,
            'opponent_score' => 0,
            'result' => json_encode(['status' => 'won', 'winner' => 'player']),
            'game_mode' => 'multiplayer',
        ]);

        Sanctum::actingAs($white);

        $response = $this->postJson('/api/v1/game-history', $this->reportPayload([
            'game_id' => $game->id,
            'game_mode' => 'multiplayer',
            'moves' => 'e4,1.00;e5,1.00',
            'best_button_uses' => 0,
        ]));

        $response->assertOk()
            ->assertJsonPath('data.id', $existing->id)
            ->assertJsonPath('data.review_summary.analyzed_moves', 1);

        $existing->refresh();

        $this->assertSame('e4,1.00', $existing->moves);
        $this->assertSame(0, $existing->best_button_uses);
        $this->assertTrue($existing->review_enabled_used);
        $this->assertSame(2, $existing->review_report['moves'][0]['userMoveRank']);

        $stats = UserMoveReviewStats::query()->where('user_id', $white->id)->firstOrFail();
        $this->assertSame(1, $stats->games_analyzed);
        $this->assertSame(0, $stats->best_button_uses);
        $this->assertSame(1, $stats->top_2_count);
        $this->assertSame(2, $stats->coins_earned);

        $this->postJson('/api/v1/game-history', $this->reportPayload([
            'game_id' => $game->id,
            'game_mode' => 'multiplayer',
            'moves' => 'e4,1.00;e5,1.00',
            'best_button_uses' => 3,
        ]))->assertOk();

        $stats->refresh();
        $this->assertSame(1, $stats->games_analyzed);
        $this->assertSame(3, $stats->best_button_uses);
        $this->assertSame(2, $stats->coins_earned);
    }

    public function test_review_stats_endpoint_returns_current_user_totals_without_double_counting(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/game-history', $this->reportPayload())
            ->assertCreated();

        $history = GameHistory::query()->where('user_id', $user->id)->firstOrFail();

        $this->postJson('/api/v1/game-history', $this->reportPayload([
            'game_id' => $history->game_id,
            'best_button_uses' => 4,
        ]))->assertCreated();

        $response = $this->getJson('/api/v1/game-history/review-stats');

        $response->assertOk()
            ->assertJsonPath('data.games_analyzed', 2)
            ->assertJsonPath('data.analyzed_moves', 2)
            ->assertJsonPath('data.top_2_count', 2)
            ->assertJsonPath('data.best_button_uses', 6)
            ->assertJsonPath('data.coins_earned', 4)
            ->assertJsonPath('data.average_rank', 2);
    }

    public function test_public_game_history_does_not_create_user_review_stats(): void
    {
        $response = $this->postJson('/api/public/game-history', $this->reportPayload([
            'played_at' => null,
        ]));

        $response->assertCreated()
            ->assertJsonPath('data.review_summary.coins_earned', 2);

        $this->assertSame(0, UserMoveReviewStats::query()->count());
    }
}
