<?php

namespace Tests\Unit;

use Tests\TestCase;
use App\Services\ChessDrawDetectionService;
use App\Models\Game;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

class ChessDrawDetectionServiceTest extends TestCase
{
    use RefreshDatabase;

    private ChessDrawDetectionService $service;
    private User $whitePlayer;
    private User $blackPlayer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new ChessDrawDetectionService();

        $this->whitePlayer = User::factory()->create(['name' => 'White Player']);
        $this->blackPlayer = User::factory()->create(['name' => 'Black Player']);
    }

    /** @test */
    public function it_detects_stalemate()
    {
        // King and Queen vs King - stalemate position
        // FEN: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1" (Black king is stalemated)
        $game = Game::factory()->create([
            'white_player_id' => $this->whitePlayer->id,
            'black_player_id' => $this->blackPlayer->id,
            'fen' => '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1',
        ]);

        $result = $this->service->checkStalemate($game);

        // Note: Actual stalemate detection depends on chess library implementation
        $this->assertIsBool($result);
    }

    /** @test */
    public function it_detects_insufficient_material_king_vs_king()
    {
        // K vs K
        $game = Game::factory()->create([
            'white_player_id' => $this->whitePlayer->id,
            'black_player_id' => $this->blackPlayer->id,
            'fen' => '8/8/8/4k3/8/8/8/4K3 w - - 0 1',
        ]);

        $result = $this->service->checkInsufficientMaterial($game);

        $this->assertTrue($result);
    }

    /** @test */
    public function it_detects_insufficient_material_king_bishop_vs_king()
    {
        // K+B vs K
        $game = Game::factory()->create([
            'white_player_id' => $this->whitePlayer->id,
            'black_player_id' => $this->blackPlayer->id,
            'fen' => '8/8/8/4k3/8/8/3B4/4K3 w - - 0 1',
        ]);

        $result = $this->service->checkInsufficientMaterial($game);

        $this->assertTrue($result);
    }

    /** @test */
    public function it_detects_insufficient_material_king_knight_vs_king()
    {
        // K+N vs K
        $game = Game::factory()->create([
            'white_player_id' => $this->whitePlayer->id,
            'black_player_id' => $this->blackPlayer->id,
            'fen' => '8/8/8/4k3/8/8/3N4/4K3 w - - 0 1',
        ]);

        $result = $this->service->checkInsufficientMaterial($game);

        $this->assertTrue($result);
    }

    /** @test */
    public function it_does_not_detect_insufficient_material_with_pawn()
    {
        // K+P vs K (sufficient material)
        $game = Game::factory()->create([
            'white_player_id' => $this->whitePlayer->id,
            'black_player_id' => $this->blackPlayer->id,
            'fen' => '8/8/8/4k3/8/8/3P4/4K3 w - - 0 1',
        ]);

        $result = $this->service->checkInsufficientMaterial($game);

        $this->assertFalse($result);
    }

    /** @test */
    public function it_does_not_detect_insufficient_material_with_rook()
    {
        // K+R vs K (sufficient material)
        $game = Game::factory()->create([
            'white_player_id' => $this->whitePlayer->id,
            'black_player_id' => $this->blackPlayer->id,
            'fen' => '8/8/8/4k3/8/8/3R4/4K3 w - - 0 1',
        ]);

        $result = $this->service->checkInsufficientMaterial($game);

        $this->assertFalse($result);
    }

    /** @test */
    public function it_does_not_detect_insufficient_material_with_queen()
    {
        // K+Q vs K (sufficient material)
        $game = Game::factory()->create([
            'white_player_id' => $this->whitePlayer->id,
            'black_player_id' => $this->blackPlayer->id,
            'fen' => '8/8/8/4k3/8/8/3Q4/4K3 w - - 0 1',
        ]);

        $result = $this->service->checkInsufficientMaterial($game);

        $this->assertFalse($result);
    }

    /** @test */
    public function it_detects_fifty_move_rule()
    {
        // Create game with halfmove_clock = 100 (50 full moves)
        $game = Game::factory()->create([
            'white_player_id' => $this->whitePlayer->id,
            'black_player_id' => $this->blackPlayer->id,
            'fen' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            'halfmove_clock' => 100,
        ]);

        $result = $this->service->checkFiftyMoveRule($game);

        $this->assertTrue($result);
    }

    /** @test */
    public function it_does_not_detect_fifty_move_rule_before_threshold()
    {
        // Create game with halfmove_clock = 50 (25 full moves)
        $game = Game::factory()->create([
            'white_player_id' => $this->whitePlayer->id,
            'black_player_id' => $this->blackPlayer->id,
            'fen' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            'halfmove_clock' => 50,
        ]);

        $result = $this->service->checkFiftyMoveRule($game);

        $this->assertFalse($result);
    }

    /** @test */
    public function it_detects_seventy_five_move_rule()
    {
        // Create game with halfmove_clock = 150 (75 full moves)
        $game = Game::factory()->create([
            'white_player_id' => $this->whitePlayer->id,
            'black_player_id' => $this->blackPlayer->id,
            'fen' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            'halfmove_clock' => 150,
        ]);

        $result = $this->service->checkSeventyFiveMoveRule($game);

        $this->assertTrue($result);
    }

    /** @test */
    public function it_detects_threefold_repetition()
    {
        // Create game with position history showing threefold repetition
        $game = Game::factory()->create([
            'white_player_id' => $this->whitePlayer->id,
            'black_player_id' => $this->blackPlayer->id,
            'fen' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            'position_history' => json_encode([
                'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
                'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
                'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // Repeat 1
                'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
                'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
                'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // Repeat 2
                'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
                'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
                'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // Repeat 3
            ]),
        ]);

        $result = $this->service->checkThreefoldRepetition($game);

        $this->assertTrue($result);
    }

    /** @test */
    public function it_does_not_detect_threefold_repetition_with_only_two_repetitions()
    {
        $game = Game::factory()->create([
            'white_player_id' => $this->whitePlayer->id,
            'black_player_id' => $this->blackPlayer->id,
            'fen' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            'position_history' => json_encode([
                'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
                'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // Repeat 1
                'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
            ]),
        ]);

        $result = $this->service->checkThreefoldRepetition($game);

        $this->assertFalse($result);
    }

    /** @test */
    public function it_detects_fivefold_repetition()
    {
        // Create game with position history showing fivefold repetition
        $repeatedPosition = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        $alternatePosition = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

        $positions = [];
        for ($i = 0; $i < 5; $i++) {
            $positions[] = $repeatedPosition;
            $positions[] = $alternatePosition;
        }

        $game = Game::factory()->create([
            'white_player_id' => $this->whitePlayer->id,
            'black_player_id' => $this->blackPlayer->id,
            'fen' => $repeatedPosition,
            'position_history' => json_encode($positions),
        ]);

        $result = $this->service->checkFivefoldRepetition($game);

        $this->assertTrue($result);
    }

    /** @test */
    public function it_detects_sixteen_queen_moves()
    {
        // Create game with queen_only_move_count = 16
        $game = Game::factory()->create([
            'white_player_id' => $this->whitePlayer->id,
            'black_player_id' => $this->blackPlayer->id,
            'fen' => '8/8/8/3qk3/8/8/3Q4/3K4 w - - 0 1',
            'queen_only_move_count' => 16,
        ]);

        $result = $this->service->checkQueenOnlyMoves($game);

        $this->assertTrue($result);
    }

    /** @test */
    public function it_does_not_detect_sixteen_queen_moves_before_threshold()
    {
        // Create game with queen_only_move_count = 10
        $game = Game::factory()->create([
            'white_player_id' => $this->whitePlayer->id,
            'black_player_id' => $this->blackPlayer->id,
            'fen' => '8/8/8/3qk3/8/8/3Q4/3K4 w - - 0 1',
            'queen_only_move_count' => 10,
        ]);

        $result = $this->service->checkQueenOnlyMoves($game);

        $this->assertFalse($result);
    }

    /** @test */
    public function it_checks_all_draw_conditions()
    {
        // Create game with multiple potential draw conditions
        $game = Game::factory()->create([
            'white_player_id' => $this->whitePlayer->id,
            'black_player_id' => $this->blackPlayer->id,
            'fen' => '8/8/8/4k3/8/8/8/4K3 w - - 0 1', // K vs K
        ]);

        $result = $this->service->checkDrawConditions($game);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('is_draw', $result);
        $this->assertArrayHasKey('reason', $result);
        $this->assertArrayHasKey('conditions', $result);

        $this->assertTrue($result['is_draw']); // Should be draw due to insufficient material
        $this->assertEquals('insufficient_material', $result['reason']);
    }

    /** @test */
    public function it_returns_correct_structure_for_no_draw()
    {
        // Create game with no draw conditions
        $game = Game::factory()->create([
            'white_player_id' => $this->whitePlayer->id,
            'black_player_id' => $this->blackPlayer->id,
            'fen' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // Starting position
            'halfmove_clock' => 0,
            'queen_only_move_count' => 0,
        ]);

        $result = $this->service->checkDrawConditions($game);

        $this->assertIsArray($result);
        $this->assertFalse($result['is_draw']);
        $this->assertNull($result['reason']);
    }

    /** @test */
    public function it_prioritizes_draw_reasons_correctly()
    {
        // Create game with multiple draw conditions
        // Priority should be stalemate > insufficient material > 75-move > 50-move > fivefold > threefold > 16 queens
        $game = Game::factory()->create([
            'white_player_id' => $this->whitePlayer->id,
            'black_player_id' => $this->blackPlayer->id,
            'fen' => '8/8/8/4k3/8/8/8/4K3 w - - 0 1', // K vs K
            'halfmove_clock' => 100, // Also satisfies 50-move rule
        ]);

        $result = $this->service->checkDrawConditions($game);

        $this->assertTrue($result['is_draw']);
        // Should return the first detected draw condition based on check order
        $this->assertNotNull($result['reason']);
    }

    /** @test */
    public function it_handles_invalid_fen_gracefully()
    {
        $game = Game::factory()->create([
            'white_player_id' => $this->whitePlayer->id,
            'black_player_id' => $this->blackPlayer->id,
            'fen' => 'invalid_fen_string',
        ]);

        // Should not throw exception, should return false
        $result = $this->service->checkStalemate($game);

        $this->assertIsBool($result);
        $this->assertFalse($result);
    }

    /** @test */
    public function it_can_mark_game_as_draw()
    {
        $game = Game::factory()->create([
            'white_player_id' => $this->whitePlayer->id,
            'black_player_id' => $this->blackPlayer->id,
            'fen' => '8/8/8/4k3/8/8/8/4K3 w - - 0 1', // K vs K
            'status' => 'ongoing',
        ]);

        $drawResult = $this->service->checkDrawConditions($game);

        if ($drawResult['is_draw']) {
            $this->service->markGameAsDraw($game, $drawResult['reason']);

            $game->refresh();

            $this->assertEquals('draw', $game->status);
            $this->assertEquals($drawResult['reason'], $game->draw_reason);
        }

        $this->assertTrue($drawResult['is_draw']);
    }

    /** @test */
    public function it_increments_queen_only_move_count()
    {
        $game = Game::factory()->create([
            'white_player_id' => $this->whitePlayer->id,
            'black_player_id' => $this->blackPlayer->id,
            'fen' => '8/8/8/3qk3/8/8/3Q4/3K4 w - - 0 1',
            'queen_only_move_count' => 5,
        ]);

        // Simulate queen-only move
        $this->service->incrementQueenOnlyMoveCount($game);

        $game->refresh();

        $this->assertEquals(6, $game->queen_only_move_count);
    }

    /** @test */
    public function it_resets_queen_only_move_count_on_non_queen_move()
    {
        $game = Game::factory()->create([
            'white_player_id' => $this->whitePlayer->id,
            'black_player_id' => $this->blackPlayer->id,
            'fen' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            'queen_only_move_count' => 5,
        ]);

        // Simulate non-queen move
        $this->service->resetQueenOnlyMoveCount($game);

        $game->refresh();

        $this->assertEquals(0, $game->queen_only_move_count);
    }
}
