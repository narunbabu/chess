<?php

namespace Tests\Feature;

use App\Events\GameMoveEvent;
use App\Events\UndoAcceptedEvent;
use App\Events\UndoDeclinedEvent;
use App\Events\UndoRequestedEvent;
use App\Models\Game;
use App\Models\SyntheticPlayer;
use App\Models\User;
use App\Services\GameRoomService;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/**
 * Takeback (undo) behaviour on the server.
 *
 * The assertions that matter are on what the *other* side would receive - the
 * dispatched event and the position written to the row - not on the HTTP status
 * of the request that started it. A 200 for a request nobody can hear is exactly
 * how this feature shipped broken.
 */
class UndoTakebackTest extends TestCase
{
    private const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    public function test_request_undo_dispatches_the_documented_event(): void
    {
        $this->fakeBroadcastEvents();

        [$game, $white, $black] = $this->activeGameAfterOpeningMoves();

        $result = app(GameRoomService::class)->requestUndo($game->id, $white->id);

        $this->assertTrue($result['success']);
        $this->assertNotEmpty($result['expires_at']);

        Event::assertDispatched(UndoRequestedEvent::class, function (UndoRequestedEvent $event) use ($game, $white) {
            $payload = $event->broadcastWith();

            $this->assertSame('game.undo.request', $event->broadcastAs());
            $this->assertSame('private-game.' . $game->id, $event->broadcastOn()->name);
            $this->assertSame($white->id, $payload['requested_by_user_id']);
            $this->assertSame($white->name, $payload['requested_by_user_name']);
            $this->assertNotNull($payload['expires_at']);
            $this->assertGreaterThan(now()->addSeconds(20), \Carbon\Carbon::parse($payload['expires_at']));

            return true;
        });
    }

    public function test_accepting_after_two_moves_restores_the_exact_starting_position(): void
    {
        $this->fakeBroadcastEvents();

        [$game, $white, $black] = $this->activeGameAfterOpeningMoves();

        $service = app(GameRoomService::class);
        $service->requestUndo($game->id, $white->id);
        $result = $service->acceptUndo($game->id, $black->id);

        $this->assertTrue($result['success'], $result['message'] ?? '');

        $game->refresh();

        // The direct assertion for the two defects on the old accept path: a
        // next_fen key that is never stored, and a fallback FEN with a black
        // queen on b7. Rank 7 is pppppppp, not pqpppppp.
        $this->assertSame(self::STARTING_FEN, $game->fen);
        $this->assertSame([], $game->moves);
        $this->assertSame(0, $game->move_count);
        $this->assertSame('white', $game->turn);

        Event::assertDispatched(UndoAcceptedEvent::class, function (UndoAcceptedEvent $event) use ($black) {
            $payload = $event->broadcastWith();

            $this->assertSame('game.undo.accepted', $event->broadcastAs());
            $this->assertSame(self::STARTING_FEN, $payload['fen']);
            $this->assertSame(0, $payload['move_count']);
            $this->assertSame($black->id, $payload['accepted_by_user_id']);
            $this->assertFalse($payload['accepted_by_synthetic']);

            return true;
        });
    }

    public function test_accepting_after_four_moves_replays_back_to_the_position_after_ply_two(): void
    {
        $this->fakeBroadcastEvents();

        [$game, $white, $black] = $this->activeGameAfterOpeningMoves();

        $service = app(GameRoomService::class);

        // Position the takeback must restore, as the move path itself wrote it.
        $fenAfterTwoPlies = $game->fresh()->fen;

        $service->broadcastMove($game->id, $white->id, $this->movePayload('g1', 'f3', 'Nf3', 'n'), 'test-socket');
        $service->broadcastMove($game->id, $black->id, $this->movePayload('b8', 'c6', 'Nc6', 'n'), 'test-socket');

        $game->refresh();
        $this->assertSame(4, $game->move_count);
        $this->assertNotSame($fenAfterTwoPlies, $game->fen);

        $service->requestUndo($game->id, $white->id);
        $result = $service->acceptUndo($game->id, $black->id);

        $this->assertTrue($result['success'], $result['message'] ?? '');

        $game->refresh();

        $this->assertSame($fenAfterTwoPlies, $game->fen);
        $this->assertSame(2, $game->move_count);
        $this->assertCount(2, $game->moves);
        $this->assertSame('e2', $game->moves[0]['from']);
        $this->assertSame('e7', $game->moves[1]['from']);
        $this->assertSame('white', $game->turn);

        // The stored moves carry no next_fen - the position came from a replay.
        $this->assertArrayNotHasKey('next_fen', $game->moves[0]);
        $this->assertArrayNotHasKey('next_fen', $game->moves[1]);
    }

    public function test_only_the_requesters_undo_budget_is_decremented(): void
    {
        $this->fakeBroadcastEvents();

        [$game, $white, $black] = $this->activeGameAfterOpeningMoves();

        $whiteBefore = $game->undo_white_remaining;
        $blackBefore = $game->undo_black_remaining;

        $this->assertGreaterThan(0, $whiteBefore);

        $service = app(GameRoomService::class);
        $service->requestUndo($game->id, $white->id);
        $service->acceptUndo($game->id, $black->id);

        $game->refresh();

        $this->assertSame($whiteBefore - 1, $game->undo_white_remaining);
        $this->assertSame($blackBefore, $game->undo_black_remaining);
    }

    public function test_a_bot_game_answers_the_takeback_itself(): void
    {
        $this->fakeBroadcastEvents();

        $human = User::factory()->create();
        $bot = SyntheticPlayer::create([
            'name' => 'Aarav Beginner',
            'avatar_seed' => 'aarav-beginner',
            'rating' => 800,
            'computer_level' => 1,
            'personality' => 'Balanced',
            'bio' => 'Learning the basics',
            'is_active' => true,
        ]);

        $game = Game::factory()->create([
            'white_player_id' => $human->id,
            'black_player_id' => null,
            'synthetic_player_id' => $bot->id,
            'game_mode' => 'casual',
            'status' => 'active',
            'fen' => 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
            'turn' => 'white',
            'moves' => [
                ['from' => 'e2', 'to' => 'e4', 'promotion' => null, 'san' => 'e4', 'user_id' => $human->id],
                ['from' => 'e7', 'to' => 'e5', 'promotion' => null, 'san' => 'e5', 'user_id' => 'synthetic'],
            ],
            'move_count' => 2,
        ]);

        $result = app(GameRoomService::class)->requestUndo($game->id, $human->id);

        $this->assertTrue($result['success'], $result['message'] ?? '');
        $this->assertTrue($result['auto_accepted']);

        // There is nobody to hear a request, so none is sent.
        Event::assertNotDispatched(UndoRequestedEvent::class);

        Event::assertDispatched(UndoAcceptedEvent::class, function (UndoAcceptedEvent $event) use ($bot) {
            $payload = $event->broadcastWith();

            $this->assertNull($payload['accepted_by_user_id']);
            $this->assertTrue($payload['accepted_by_synthetic']);
            $this->assertSame($bot->name, $payload['accepted_by_user_name']);
            $this->assertSame(self::STARTING_FEN, $payload['fen']);

            return true;
        });

        $game->refresh();

        $this->assertSame(self::STARTING_FEN, $game->fen);
        $this->assertSame([], $game->moves);
        $this->assertSame(0, $game->move_count);
        $this->assertSame('white', $game->turn);
        $this->assertSame(Game::CASUAL_UNDO_CHANCES - 1, $game->undo_white_remaining);
        $this->assertSame(Game::CASUAL_UNDO_CHANCES, $game->undo_black_remaining);
    }

    public function test_an_expired_request_cannot_be_accepted(): void
    {
        $this->fakeBroadcastEvents();

        [$game, $white, $black] = $this->activeGameAfterOpeningMoves();

        $service = app(GameRoomService::class);
        $service->requestUndo($game->id, $white->id);

        $fenBefore = $game->fresh()->fen;

        $this->travel(40)->seconds();

        $result = $service->acceptUndo($game->id, $black->id);

        $this->assertFalse($result['success']);
        $this->assertSame('This takeback request has expired', $result['message']);

        Event::assertNotDispatched(UndoAcceptedEvent::class);

        $game->refresh();

        $this->assertSame($fenBefore, $game->fen);
        $this->assertSame(2, $game->move_count);
        $this->assertSame(Game::CASUAL_UNDO_CHANCES, $game->undo_white_remaining);
    }

    public function test_declining_clears_the_pending_request(): void
    {
        $this->fakeBroadcastEvents();

        [$game, $white, $black] = $this->activeGameAfterOpeningMoves();

        $service = app(GameRoomService::class);
        $service->requestUndo($game->id, $white->id);

        $declined = $service->declineUndo($game->id, $black->id);
        $this->assertTrue($declined['success']);
        Event::assertDispatched(UndoDeclinedEvent::class);

        $result = $service->acceptUndo($game->id, $black->id);

        $this->assertFalse($result['success']);
        $this->assertSame('This takeback request has expired', $result['message']);
        Event::assertNotDispatched(UndoAcceptedEvent::class);

        $this->assertSame(2, $game->fresh()->move_count);
    }

    public function test_a_pending_request_is_bound_to_the_position_it_was_made_on(): void
    {
        $this->fakeBroadcastEvents();

        [$game, $white, $black] = $this->activeGameAfterOpeningMoves();
        $service = app(GameRoomService::class);
        $service->requestUndo($game->id, $white->id);

        // A move racing the response changes the position version. The old
        // request must not roll back a different pair of plies.
        $service->broadcastMove(
            $game->id,
            $white->id,
            $this->movePayload('g1', 'f3', 'Nf3', 'n'),
            'test-socket'
        );
        $fenAfterRacingMove = $game->fresh()->fen;

        $result = $service->acceptUndo($game->id, $black->id);

        $this->assertFalse($result['success']);
        $this->assertSame('The game changed after this takeback was requested', $result['message']);
        Event::assertNotDispatched(UndoAcceptedEvent::class);
        $this->assertSame($fenAfterRacingMove, $game->fresh()->fen);
        $this->assertSame(3, $game->fresh()->move_count);
        $this->assertSame(Game::CASUAL_UNDO_CHANCES, $game->fresh()->undo_white_remaining);
    }

    public function test_the_same_request_can_only_be_accepted_once(): void
    {
        $this->fakeBroadcastEvents();

        [$game, $white, $black] = $this->activeGameAfterOpeningMoves();
        $service = app(GameRoomService::class);
        $service->broadcastMove($game->id, $white->id, $this->movePayload('g1', 'f3', 'Nf3', 'n'), 'test-socket');
        $service->broadcastMove($game->id, $black->id, $this->movePayload('b8', 'c6', 'Nc6', 'n'), 'test-socket');

        $service->requestUndo($game->id, $white->id);
        $first = $service->acceptUndo($game->id, $black->id);
        $second = $service->acceptUndo($game->id, $black->id);

        $this->assertTrue($first['success']);
        $this->assertFalse($second['success']);
        $this->assertSame('This takeback request has expired', $second['message']);
        Event::assertDispatchedTimes(UndoAcceptedEvent::class, 1);
        $this->assertSame(2, $game->fresh()->move_count);
        $this->assertSame(Game::CASUAL_UNDO_CHANCES - 1, $game->fresh()->undo_white_remaining);
    }

    /**
     * Fake only the broadcast events under test.
     *
     * A bare Event::fake() would also swallow Eloquent's model events, and Game's
     * creating hook is what seeds the casual undo budget - the counters would fall
     * back to the column default and the budget assertions would test nothing.
     */
    private function fakeBroadcastEvents(): void
    {
        Event::fake([
            GameMoveEvent::class,
            UndoRequestedEvent::class,
            UndoAcceptedEvent::class,
            UndoDeclinedEvent::class,
        ]);
    }

    /**
     * A casual, active game with 1.e4 e5 played through the real move path, so the
     * stored moves have exactly the shape production writes (no next_fen).
     *
     * @return array{0: Game, 1: User, 2: User}
     */
    private function activeGameAfterOpeningMoves(): array
    {
        $white = User::factory()->create();
        $black = User::factory()->create();

        $game = Game::factory()->create([
            'white_player_id' => $white->id,
            'black_player_id' => $black->id,
            'game_mode' => 'casual',
            'status' => 'active',
            'fen' => self::STARTING_FEN,
            'turn' => 'white',
            'moves' => [],
        ]);

        $service = app(GameRoomService::class);
        $service->broadcastMove($game->id, $white->id, $this->movePayload('e2', 'e4', 'e4', 'p'), 'test-socket');
        $service->broadcastMove($game->id, $black->id, $this->movePayload('e7', 'e5', 'e5', 'p'), 'test-socket');

        $game->refresh();

        $this->assertSame(2, $game->move_count);
        $this->assertSame('white', $game->turn);
        $this->assertSame(Game::CASUAL_UNDO_CHANCES, $game->undo_white_remaining);

        return [$game, $white, $black];
    }

    private function movePayload(string $from, string $to, string $san, string $piece): array
    {
        return [
            'from' => $from,
            'to' => $to,
            'promotion' => null,
            'san' => $san,
            'uci' => $from . $to,
            'piece' => $piece,
            'color' => null,
            'captured' => null,
            'flags' => null,
            // Sent by the clients and deliberately stripped before storage - the
            // reason the accept path cannot read a position back out of a move.
            'next_fen' => null,
            'is_mate_hint' => false,
            'is_check' => false,
            'is_stalemate' => false,
            'is_threefold_repetition' => false,
            'move_time_ms' => 1000,
        ];
    }
}
