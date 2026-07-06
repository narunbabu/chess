<?php

namespace Tests\Feature;

use App\Events\GameChatMessageSent;
use App\Models\Game;
use App\Models\GameChatMessage;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ChatSafetyTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([GameChatMessageSent::class]);
    }

    public function test_under_thirteen_players_are_limited_to_presets(): void
    {
        $child = User::factory()->create(['birthday' => now()->subYears(10)->toDateString()]);
        $opponent = User::factory()->create();
        $game = $this->gameFor($child, $opponent);

        Sanctum::actingAs($child);

        $this->postJson("/api/websocket/games/{$game->id}/chat", [
            'message' => 'hello from free text',
        ])->assertStatus(422);

        $this->assertDatabaseCount('game_chat_messages', 0);

        $this->postJson("/api/websocket/games/{$game->id}/chat", [
            'message' => 'Good luck!',
        ])
            ->assertCreated()
            ->assertJsonPath('message', 'Good luck!')
            ->assertJsonPath('message_type', 'preset')
            ->assertJsonPath('chat_policy.preset_only', true);
    }

    public function test_free_text_is_filtered_and_original_text_is_stored(): void
    {
        $player = User::factory()->create(['birthday' => now()->subYears(20)->toDateString()]);
        $opponent = User::factory()->create();
        $game = $this->gameFor($player, $opponent);

        Sanctum::actingAs($player);

        $response = $this->postJson("/api/websocket/games/{$game->id}/chat", [
            'message' => 'visit https://example.com you idiot',
        ])
            ->assertCreated()
            ->assertJsonPath('filtered', true)
            ->assertJsonPath('safety_action', 'filtered');

        $this->assertStringContainsString('[link removed]', $response->json('message'));
        $this->assertStringContainsString('*****', $response->json('message'));

        $this->assertDatabaseHas('game_chat_messages', [
            'id' => $response->json('id'),
            'original_message' => 'visit https://example.com you idiot',
            'filtered' => true,
        ]);
    }

    public function test_players_can_report_opponent_chat_messages(): void
    {
        $reporter = User::factory()->create();
        $reported = User::factory()->create();
        $game = $this->gameFor($reporter, $reported);
        $message = GameChatMessage::create([
            'game_id' => $game->id,
            'user_id' => $reported->id,
            'message' => 'unsafe chat',
        ]);

        Sanctum::actingAs($reporter);

        $this->postJson("/api/websocket/games/{$game->id}/chat/{$message->id}/report", [
            'reason' => 'unsafe_language',
            'note' => 'Test report',
        ])
            ->assertCreated()
            ->assertJsonPath('report.status', 'pending')
            ->assertJsonPath('report.reported_user.id', $reported->id);

        $this->assertDatabaseHas('chat_message_reports', [
            'game_chat_message_id' => $message->id,
            'game_id' => $game->id,
            'reporter_id' => $reporter->id,
            'reported_user_id' => $reported->id,
            'reason' => 'unsafe_language',
            'status' => 'pending',
        ]);
    }

    public function test_blocking_an_opponent_disables_chat_between_players(): void
    {
        $white = User::factory()->create();
        $black = User::factory()->create();
        $game = $this->gameFor($white, $black);

        Sanctum::actingAs($white);

        $this->postJson("/api/users/{$black->id}/block")
            ->assertCreated();

        $this->getJson("/api/websocket/games/{$game->id}/chat")
            ->assertOk()
            ->assertJsonPath('chat_policy.enabled', false)
            ->assertJsonPath('chat_policy.reason', 'blocked');

        $this->postJson("/api/websocket/games/{$game->id}/chat", [
            'message' => 'Good luck!',
        ])->assertStatus(422);

        $this->assertDatabaseCount('game_chat_messages', 0);
    }

    private function gameFor(User $white, User $black): Game
    {
        return Game::factory()->create([
            'white_player_id' => $white->id,
            'black_player_id' => $black->id,
            'status' => 'active',
        ]);
    }
}
