<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\GameHistory;
use App\Models\User;
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
                'average_rank' => 2,
                'outside_top_moves_count' => 0,
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
        $this->assertSame(2, $history->review_report['moves'][0]['userMoveRank']);

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
    }
}
