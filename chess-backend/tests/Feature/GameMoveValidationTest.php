<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\User;
use App\Services\GameRoomService;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class GameMoveValidationTest extends TestCase
{
    public function test_server_allows_castling_when_castling_rights_are_valid(): void
    {
        Event::fake();

        $white = User::factory()->create();
        $black = User::factory()->create();

        $game = Game::factory()->create([
            'white_player_id' => $white->id,
            'black_player_id' => $black->id,
            'status' => 'active',
            'fen' => '4k3/8/8/8/8/8/8/4K2R w K - 0 1',
            'turn' => 'white',
            'moves' => [],
        ]);

        app(GameRoomService::class)->broadcastMove(
            $game->id,
            $white->id,
            $this->movePayload('e1', 'g1', 'O-O'),
            'test-socket'
        );

        $game->refresh();

        $this->assertSame('black', $game->turn);
        $this->assertStringStartsWith('4k3/8/8/8/8/8/8/5RK1 b - ', $game->fen);
    }

    public function test_server_rejects_castling_after_king_has_moved(): void
    {
        Event::fake();

        $white = User::factory()->create();
        $black = User::factory()->create();

        $game = Game::factory()->create([
            'white_player_id' => $white->id,
            'black_player_id' => $black->id,
            'status' => 'active',
            'fen' => '4k3/8/8/8/8/8/8/4K2R w K - 0 1',
            'turn' => 'white',
            'moves' => [],
        ]);

        $service = app(GameRoomService::class);

        $service->broadcastMove(
            $game->id,
            $white->id,
            $this->movePayload('e1', 'e2', 'Ke2', '4k3/8/8/8/8/8/4K3/7R b K - 1 1'),
            'test-socket'
        );

        $game->refresh();
        $this->assertStringContainsString(' b - ', $game->fen);

        $service->broadcastMove($game->id, $black->id, $this->movePayload('e8', 'e7', 'Ke7'), 'test-socket');
        $service->broadcastMove($game->id, $white->id, $this->movePayload('e2', 'e1', 'Ke1'), 'test-socket');
        $service->broadcastMove($game->id, $black->id, $this->movePayload('e7', 'e8', 'Ke8'), 'test-socket');

        $game->refresh();
        $fenBeforeIllegalCastle = $game->fen;

        try {
            $service->broadcastMove(
                $game->id,
                $white->id,
                $this->movePayload('e1', 'g1', 'O-O', '4k3/8/8/8/8/8/8/5RK1 b - - 5 3'),
                'test-socket'
            );

            $this->fail('Castling after the king moved should be rejected.');
        } catch (\Exception $e) {
            $this->assertSame('Illegal move', $e->getMessage());
        }

        $this->assertSame($fenBeforeIllegalCastle, $game->fresh()->fen);
    }

    public function test_server_uses_authoritative_fen_instead_of_client_next_fen(): void
    {
        Event::fake();

        $white = User::factory()->create();
        $black = User::factory()->create();

        $game = Game::factory()->create([
            'white_player_id' => $white->id,
            'black_player_id' => $black->id,
            'status' => 'active',
            'fen' => '4k3/8/8/8/8/8/8/4K2R w K - 0 1',
            'turn' => 'white',
            'moves' => [],
        ]);

        app(GameRoomService::class)->broadcastMove(
            $game->id,
            $white->id,
            $this->movePayload('e1', 'e2', 'Ke2', '4k3/8/8/8/8/8/4K3/7R b K - 1 1'),
            'test-socket'
        );

        $game->refresh();

        $this->assertSame('black', $game->turn);
        $this->assertStringContainsString(' b - ', $game->fen);
        $this->assertStringNotContainsString(' b K ', $game->fen);
    }

    private function movePayload(string $from, string $to, string $san, ?string $nextFen = null): array
    {
        return [
            'from' => $from,
            'to' => $to,
            'promotion' => null,
            'san' => $san,
            'uci' => $from . $to,
            'piece' => strtolower($san[0]) === 'o' ? 'k' : strtolower($san[0]),
            'color' => null,
            'captured' => null,
            'flags' => null,
            'next_fen' => $nextFen,
            'is_mate_hint' => false,
            'is_check' => false,
            'is_stalemate' => false,
            'is_threefold_repetition' => false,
            'move_time_ms' => 1000,
        ];
    }
}
