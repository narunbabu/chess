<?php

namespace App\Http\Controllers;

use App\Enums\EndReason;
use App\Models\Game;
use App\Services\DrawHandlerService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

/**
 * Draw Controller
 *
 * Handles draw offer lifecycle for chess games:
 * - Create draw offers with position evaluation
 * - Accept/decline draw offers
 * - Cancel pending offers
 * - Validate draw eligibility
 * - Track draw history
 */
class DrawController extends Controller
{
    private DrawHandlerService $drawHandler;

    public function __construct(DrawHandlerService $drawHandler)
    {
        $this->drawHandler = $drawHandler;
    }

    /**
     * Offer a draw in the current game
     *
     * POST /api/games/{gameId}/draw/offer
     *
     * @param Request $request
     * @param int $gameId
     * @return \Illuminate\Http\JsonResponse
     */
    public function offerDraw(Request $request, int $gameId)
    {
        try {
            $user = Auth::user();
            $game = Game::find($gameId);

            if (!$game) {
                return response()->json(['error' => 'Game not found'], 404);
            }

            // Verify user is a player in this game
            if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }

            // Check if this is a computer game (one player is null)
            $isComputerGame = $game->white_player_id === null || $game->black_player_id === null;

            if ($isComputerGame) {
                // Computer auto-accepts all draw offers
                Log::info('Draw offer auto-accepted by computer', [
                    'game_id' => $gameId,
                    'user_id' => $user->id
                ]);

                // End game as draw
                $game->status = 'completed';
                $game->end_reason = EndReason::DRAW_AGREED->value;
                $game->result = 'draw';
                $game->ended_at = now();
                $game->save();

                return response()->json([
                    'message' => 'Draw offer accepted by computer',
                    'auto_accepted' => true,
                    'status' => 'accepted',
                    'game' => $game
                ], 200);
            }

            // For multiplayer games, validate and create draw offer
            $validation = $this->drawHandler->validateDrawOffer($game, $user->id);

            if (!$validation['allowed']) {
                Log::warning('Draw offer validation failed', [
                    'game_id' => $gameId,
                    'user_id' => $user->id,
                    'reason' => $validation['reason'],
                    'game_status' => $game->status,
                    'moves_count' => count($game->moves ?? []),
                    'is_computer_game' => $game->isComputerGame()
                ]);

                return response()->json([
                    'error' => 'Draw offer not allowed',
                    'reason' => $validation['reason'],
                    'debug_info' => [
                        'game_status' => $game->status,
                        'moves_count' => count($game->moves ?? []),
                        'is_computer_game' => $game->isComputerGame()
                    ]
                ], 400);
            }

            // Create draw offer
            $drawOffer = $this->drawHandler->createDrawOffer($game, $user->id);

            Log::info('Draw offer created', [
                'game_id' => $gameId,
                'offering_user_id' => $user->id,
                'position_eval' => $drawOffer['position_eval']
            ]);

            return response()->json([
                'message' => 'Draw offer sent',
                'draw_offer' => [
                    'game_id' => $drawOffer['game_id'],
                    'offering_user_id' => $drawOffer['offering_user_id'],
                    'receiving_user_id' => $drawOffer['receiving_user_id'],
                    'position_eval' => $drawOffer['position_eval'],
                    'offering_player_rating_impact' => $drawOffer['offering_player_rating_impact'],
                    'receiving_player_rating_impact' => $drawOffer['receiving_player_rating_impact'],
                    'status' => $drawOffer['status'],
                    'offered_at' => $drawOffer['offered_at']
                ]
            ], 201);

        } catch (\Exception $e) {
            Log::error('Draw offer failed', [
                'game_id' => $gameId,
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'error' => 'Failed to create draw offer',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Accept a pending draw offer
     *
     * POST /api/games/{gameId}/draw/accept
     *
     * @param Request $request
     * @param int $gameId
     * @return \Illuminate\Http\JsonResponse
     */
    public function acceptDraw(Request $request, int $gameId)
    {
        try {
            $user = Auth::user();
            $game = Game::find($gameId);

            if (!$game) {
                return response()->json(['error' => 'Game not found'], 404);
            }

            // Verify user is a player in this game
            if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }

            // Accept draw offer
            $result = $this->drawHandler->acceptDrawOffer($game, $user->id);

            Log::info('Draw accepted', [
                'game_id' => $gameId,
                'accepting_user_id' => $user->id,
                'game_result' => $result['game_result']
            ]);

            return response()->json([
                'message' => 'Draw accepted. Game ended.',
                'result' => $result['game_result'],
                'rating_impacts' => [
                    'offering_player' => $result['offering_player_rating_impact'],
                    'receiving_player' => $result['receiving_player_rating_impact']
                ],
                'position_eval' => $result['position_eval'],
                'game' => $game->load(['whitePlayer', 'blackPlayer', 'statusRelation', 'endReasonRelation'])
            ]);

        } catch (\Exception $e) {
            Log::error('Draw acceptance failed', [
                'game_id' => $gameId,
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to accept draw',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Decline a pending draw offer
     *
     * POST /api/games/{gameId}/draw/decline
     *
     * @param Request $request
     * @param int $gameId
     * @return \Illuminate\Http\JsonResponse
     */
    public function declineDraw(Request $request, int $gameId)
    {
        try {
            $user = Auth::user();
            $game = Game::find($gameId);

            if (!$game) {
                return response()->json(['error' => 'Game not found'], 404);
            }

            // Verify user is a player in this game
            if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }

            // Decline draw offer
            $result = $this->drawHandler->declineDrawOffer($game, $user->id);

            Log::info('Draw declined', [
                'game_id' => $gameId,
                'declining_user_id' => $user->id
            ]);

            return response()->json([
                'message' => 'Draw offer declined. Game continues.',
                'game_continues' => $result['game_continues']
            ]);

        } catch (\Exception $e) {
            Log::error('Draw decline failed', [
                'game_id' => $gameId,
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to decline draw',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Cancel a pending draw offer (by the offering player)
     *
     * POST /api/games/{gameId}/draw/cancel
     *
     * @param Request $request
     * @param int $gameId
     * @return \Illuminate\Http\JsonResponse
     */
    public function cancelDraw(Request $request, int $gameId)
    {
        try {
            $user = Auth::user();
            $game = Game::find($gameId);

            if (!$game) {
                return response()->json(['error' => 'Game not found'], 404);
            }

            // Verify user is a player in this game
            if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }

            // Cancel draw offer
            $result = $this->drawHandler->cancelDrawOffer($game, $user->id);

            Log::info('Draw offer canceled', [
                'game_id' => $gameId,
                'canceling_user_id' => $user->id
            ]);

            return response()->json([
                'message' => 'Draw offer canceled.',
                'game_continues' => $result['game_continues']
            ]);

        } catch (\Exception $e) {
            Log::error('Draw cancellation failed', [
                'game_id' => $gameId,
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to cancel draw offer',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get current draw offer status for a game
     *
     * GET /api/games/{gameId}/draw/status
     *
     * @param int $gameId
     * @return \Illuminate\Http\JsonResponse
     */
    public function getDrawStatus(int $gameId)
    {
        try {
            $user = Auth::user();
            $game = Game::find($gameId);

            if (!$game) {
                return response()->json(['error' => 'Game not found'], 404);
            }

            // Verify user is a player in this game
            if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }

            // Get draw offer data
            $drawOffer = $this->drawHandler->getDrawOfferData($gameId);

            return response()->json([
                'has_pending_offer' => $drawOffer !== null,
                'draw_offer' => $drawOffer
            ]);

        } catch (\Exception $e) {
            Log::error('Draw status fetch failed', [
                'game_id' => $gameId,
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to get draw status',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get draw history for a game
     *
     * GET /api/games/{gameId}/draw/history
     *
     * @param int $gameId
     * @return \Illuminate\Http\JsonResponse
     */
    public function getDrawHistory(int $gameId)
    {
        try {
            $user = Auth::user();
            $game = Game::find($gameId);

            if (!$game) {
                return response()->json(['error' => 'Game not found'], 404);
            }

            // Verify user is a player in this game
            if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }

            // Get draw history
            $history = $this->drawHandler->getDrawHistory($gameId);

            return response()->json([
                'game_id' => $gameId,
                'draw_events' => $history,
                'count' => count($history)
            ]);

        } catch (\Exception $e) {
            Log::error('Draw history fetch failed', [
                'game_id' => $gameId,
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to get draw history',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Validate if draw offer is allowed
     *
     * GET /api/games/{gameId}/draw/validate
     *
     * @param int $gameId
     * @return \Illuminate\Http\JsonResponse
     */
    public function validateDrawOffer(int $gameId)
    {
        try {
            $user = Auth::user();
            $game = Game::find($gameId);

            if (!$game) {
                return response()->json(['error' => 'Game not found'], 404);
            }

            // Verify user is a player in this game
            if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }

            // Validate draw offer
            $validation = $this->drawHandler->validateDrawOffer($game, $user->id);

            return response()->json([
                'allowed' => $validation['allowed'],
                'reason' => $validation['reason']
            ]);

        } catch (\Exception $e) {
            Log::error('Draw validation failed', [
                'game_id' => $gameId,
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to validate draw offer',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
