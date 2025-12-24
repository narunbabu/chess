<?php

namespace App\Services;

use App\Models\Game;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

/**
 * Draw Handler Service
 *
 * Handles strategic draw offers with position evaluation:
 * - Evaluates position using engine or material balance
 * - Calculates rating impact based on position
 * - Tracks draw offers in draw_events table
 * - Applies rating penalties/rewards strategically
 *
 * Draw Logic:
 * - Better position accepts draw: Rating penalty
 * - Worse position accepts draw: Rating gain
 * - Equal position: Minor adjustment
 * - Draw declined: No effect
 */
class DrawHandlerService
{
    private MoveAnalysisService $moveAnalysisService;

    public function __construct(MoveAnalysisService $moveAnalysisService)
    {
        $this->moveAnalysisService = $moveAnalysisService;
    }

    /**
     * Create a draw offer
     *
     * @param Game $game The game
     * @param int $offeringUserId User offering the draw
     * @return array Draw offer data
     */
    public function createDrawOffer(Game $game, int $offeringUserId): array
    {
        Log::info('DrawHandlerService: Creating draw offer', [
            'game_id' => $game->id,
            'offering_user_id' => $offeringUserId
        ]);

        // Validate game state
        if ($game->status !== 'active') {
            throw new \Exception('Cannot offer draw in non-active game');
        }

        // Check if there's already a pending draw offer
        $existingOffer = $this->getPendingDrawOffer($game->id);
        if ($existingOffer) {
            throw new \Exception('Draw offer already pending');
        }

        // Evaluate current position
        $playerColor = $game->getPlayerColor($offeringUserId);
        $positionEval = $this->evaluatePosition($game->fen, $playerColor);

        // Get opponent ID
        $receivingUserId = $game->getOpponent($offeringUserId)?->id;

        // Calculate potential rating impact
        $ratingImpact = $this->calculateDrawRatingImpact(
            $offeringUserId,
            $receivingUserId,
            $positionEval
        );

        // Store draw offer
        $drawOffer = [
            'game_id' => $game->id,
            'offering_user_id' => $offeringUserId,
            'receiving_user_id' => $receivingUserId,
            'position_fen' => $game->fen,
            'position_eval' => $positionEval,
            'offering_player_rating_impact' => $ratingImpact['offering_player'],
            'receiving_player_rating_impact' => $ratingImpact['receiving_player'],
            'status' => 'pending',
            'offered_at' => now(),
            'created_at' => now(),
            'updated_at' => now()
        ];

        DB::table('draw_events')->insert($drawOffer);

        Log::info('DrawHandlerService: Draw offer created', [
            'game_id' => $game->id,
            'position_eval' => $positionEval,
            'offering_impact' => $ratingImpact['offering_player'],
            'receiving_impact' => $ratingImpact['receiving_player']
        ]);

        return $drawOffer;
    }

    /**
     * Accept draw offer
     *
     * @param Game $game The game
     * @param int $acceptingUserId User accepting the draw
     * @return array Draw acceptance result
     */
    public function acceptDrawOffer(Game $game, int $acceptingUserId): array
    {
        Log::info('DrawHandlerService: Accepting draw offer', [
            'game_id' => $game->id,
            'accepting_user_id' => $acceptingUserId
        ]);

        // Get pending draw offer
        $drawOffer = $this->getPendingDrawOffer($game->id);

        if (!$drawOffer) {
            throw new \Exception('No pending draw offer found');
        }

        // Verify accepting user is the receiving user
        if ($drawOffer->receiving_user_id !== $acceptingUserId) {
            throw new \Exception('Only the receiving player can accept the draw offer');
        }

        // Update draw offer status
        DB::table('draw_events')
            ->where('id', $drawOffer->id)
            ->update([
                'status' => 'accepted',
                'responded_at' => now(),
                'updated_at' => now()
            ]);

        // Update game status
        $game->status = 'finished';
        $game->result = '1/2-1/2';
        $game->end_reason = 'draw_agreement';
        $game->ended_at = now();
        $game->save();

        Log::info('DrawHandlerService: Draw accepted, game ended', [
            'game_id' => $game->id
        ]);

        return [
            'accepted' => true,
            'game_result' => '1/2-1/2',
            'offering_player_rating_impact' => $drawOffer->offering_player_rating_impact,
            'receiving_player_rating_impact' => $drawOffer->receiving_player_rating_impact,
            'position_eval' => $drawOffer->position_eval
        ];
    }

    /**
     * Decline draw offer
     *
     * @param Game $game The game
     * @param int $decliningUserId User declining the draw
     * @return array Draw decline result
     */
    public function declineDrawOffer(Game $game, int $decliningUserId): array
    {
        Log::info('DrawHandlerService: Declining draw offer', [
            'game_id' => $game->id,
            'declining_user_id' => $decliningUserId
        ]);

        // Get pending draw offer
        $drawOffer = $this->getPendingDrawOffer($game->id);

        if (!$drawOffer) {
            throw new \Exception('No pending draw offer found');
        }

        // Verify declining user is the receiving user
        if ($drawOffer->receiving_user_id !== $decliningUserId) {
            throw new \Exception('Only the receiving player can decline the draw offer');
        }

        // Update draw offer status
        DB::table('draw_events')
            ->where('id', $drawOffer->id)
            ->update([
                'status' => 'declined',
                'responded_at' => now(),
                'updated_at' => now()
            ]);

        Log::info('DrawHandlerService: Draw declined', [
            'game_id' => $game->id
        ]);

        return [
            'declined' => true,
            'game_continues' => true
        ];
    }

    /**
     * Cancel draw offer (by the offering player)
     *
     * @param Game $game The game
     * @param int $cancelingUserId User canceling the draw offer
     * @return array Draw cancellation result
     */
    public function cancelDrawOffer(Game $game, int $cancelingUserId): array
    {
        Log::info('DrawHandlerService: Canceling draw offer', [
            'game_id' => $game->id,
            'canceling_user_id' => $cancelingUserId
        ]);

        // Get pending draw offer
        $drawOffer = $this->getPendingDrawOffer($game->id);

        if (!$drawOffer) {
            throw new \Exception('No pending draw offer found');
        }

        // Verify canceling user is the offering user
        if ($drawOffer->offering_user_id !== $cancelingUserId) {
            throw new \Exception('Only the offering player can cancel the draw offer');
        }

        // Update draw offer status
        DB::table('draw_events')
            ->where('id', $drawOffer->id)
            ->update([
                'status' => 'canceled',
                'responded_at' => now(),
                'updated_at' => now()
            ]);

        Log::info('DrawHandlerService: Draw offer canceled', [
            'game_id' => $game->id
        ]);

        return [
            'canceled' => true,
            'game_continues' => true
        ];
    }

    /**
     * Get pending draw offer for a game
     *
     * @param int $gameId Game ID
     * @return object|null Draw offer
     */
    private function getPendingDrawOffer(int $gameId): ?object
    {
        return DB::table('draw_events')
            ->where('game_id', $gameId)
            ->where('status', 'pending')
            ->first();
    }

    /**
     * Evaluate position for draw decision
     *
     * @param string $fen Position FEN
     * @param string $playerColor Player color
     * @return float Position evaluation in pawns (positive = better for player)
     */
    private function evaluatePosition(string $fen, string $playerColor): float
    {
        // Try to get engine evaluation first
        $engineEval = $this->moveAnalysisService->analyzePosition($fen);

        if ($engineEval['evaluation'] !== null) {
            $eval = $engineEval['evaluation'];
            return $playerColor === 'white' ? $eval : -$eval;
        }

        // Fallback to material balance
        return $this->calculateMaterialBalance($fen, $playerColor);
    }

    /**
     * Calculate material balance from FEN
     *
     * @param string $fen Position FEN
     * @param string $playerColor Player color
     * @return float Material balance in pawns
     */
    private function calculateMaterialBalance(string $fen, string $playerColor): float
    {
        $fenParts = explode(' ', $fen);
        $boardPosition = $fenParts[0] ?? '';

        $pieceValues = [
            'Q' => 9, 'R' => 5, 'B' => 3, 'N' => 3, 'P' => 1,
            'q' => -9, 'r' => -5, 'b' => -3, 'n' => -3, 'p' => -1
        ];

        $balance = 0;
        for ($i = 0; $i < strlen($boardPosition); $i++) {
            $piece = $boardPosition[$i];
            if (isset($pieceValues[$piece])) {
                $balance += $pieceValues[$piece];
            }
        }

        // Normalize for player color
        return $playerColor === 'black' ? -$balance : $balance;
    }

    /**
     * Calculate potential rating impact for draw
     *
     * Strategic logic:
     * - Better position accepts draw: Rating penalty
     * - Worse position accepts draw: Rating gain
     * - Equal position: Minor adjustment
     *
     * @param int $offeringUserId Offering player user ID
     * @param int|null $receivingUserId Receiving player user ID
     * @param float $positionEval Position evaluation from offering player's perspective
     * @return array Rating impacts for both players
     */
    private function calculateDrawRatingImpact(
        int $offeringUserId,
        ?int $receivingUserId,
        float $positionEval
    ): array {
        if (!$receivingUserId) {
            // Computer game - simplified logic
            return [
                'offering_player' => 0,
                'receiving_player' => 0
            ];
        }

        $offeringUser = User::find($offeringUserId);
        $receivingUser = User::find($receivingUserId);

        // Get K-factor for calculations
        $kFactor = $this->getKFactor($offeringUser->rating);

        // Calculate base adjustment
        $baseAdjustment = $kFactor * 0.1;

        // Offering player's perspective
        if ($positionEval > 1.0) {
            // Offering player is significantly better - penalty for offering draw
            $offeringImpact = -$baseAdjustment;
            $receivingImpact = $baseAdjustment;
        } elseif ($positionEval < -1.0) {
            // Offering player is significantly worse - reward for salvaging draw
            $offeringImpact = $baseAdjustment;
            $receivingImpact = -$baseAdjustment;
        } elseif ($positionEval > 0.5) {
            // Offering player is slightly better - minor penalty
            $offeringImpact = -($baseAdjustment * 0.5);
            $receivingImpact = $baseAdjustment * 0.5;
        } elseif ($positionEval < -0.5) {
            // Offering player is slightly worse - minor reward
            $offeringImpact = $baseAdjustment * 0.5;
            $receivingImpact = -($baseAdjustment * 0.5);
        } else {
            // Position is roughly equal - no adjustment
            $offeringImpact = 0;
            $receivingImpact = 0;
        }

        return [
            'offering_player' => round($offeringImpact),
            'receiving_player' => round($receivingImpact)
        ];
    }

    /**
     * Get K-factor based on rating
     *
     * @param int $rating Player rating
     * @return int K-factor
     */
    private function getKFactor(int $rating): int
    {
        if ($rating < 1000) {
            return 32;
        } elseif ($rating <= 1600) {
            return 24;
        } else {
            return 16;
        }
    }

    /**
     * Get draw offer data for a game
     *
     * @param int $gameId Game ID
     * @return array|null Draw offer data
     */
    public function getDrawOfferData(int $gameId): ?array
    {
        $drawOffer = $this->getPendingDrawOffer($gameId);

        if (!$drawOffer) {
            return null;
        }

        return [
            'id' => $drawOffer->id,
            'game_id' => $drawOffer->game_id,
            'offering_user_id' => $drawOffer->offering_user_id,
            'receiving_user_id' => $drawOffer->receiving_user_id,
            'position_eval' => $drawOffer->position_eval,
            'offering_player_rating_impact' => $drawOffer->offering_player_rating_impact,
            'receiving_player_rating_impact' => $drawOffer->receiving_player_rating_impact,
            'status' => $drawOffer->status,
            'offered_at' => $drawOffer->offered_at
        ];
    }

    /**
     * Get draw history for a game
     *
     * @param int $gameId Game ID
     * @return array Draw history
     */
    public function getDrawHistory(int $gameId): array
    {
        $drawEvents = DB::table('draw_events')
            ->where('game_id', $gameId)
            ->orderBy('offered_at', 'desc')
            ->get()
            ->toArray();

        return array_map(function ($event) {
            return (array) $event;
        }, $drawEvents);
    }

    /**
     * Check if draw is allowed in current game state
     *
     * @param Game $game The game
     * @param int $userId User ID
     * @return array Validation result
     */
    public function validateDrawOffer(Game $game, int $userId): array
    {
        // Game must be active
        if ($game->status !== 'active') {
            return [
                'allowed' => false,
                'reason' => 'Game is not active'
            ];
        }

        // Must be player's turn (optional - can allow draw offers at any time)
        // Commenting this out to allow draw offers even when it's not the player's turn
        // $playerColor = $game->getPlayerColor($userId);
        // if ($game->turn !== $playerColor) {
        //     return [
        //         'allowed' => false,
        //         'reason' => 'Not your turn'
        //     ];
        // }

        // Check minimum move requirement (e.g., 2 moves for multiplayer - each player made 1 move)
        if (!$game->isComputerGame()) {
            $minMoves = 2;

            // Try to get move count from move_count field first, fallback to moves array
            $moveCount = $game->move_count ?? count($game->moves ?? []);

            Log::info('Draw offer validation - checking moves', [
                'game_id' => $game->id,
                'move_count_field' => $game->move_count,
                'moves_array_count' => count($game->moves ?? []),
                'final_move_count' => $moveCount,
                'min_required' => $minMoves,
                'moves_data_sample' => isset($game->moves) && is_array($game->moves)
                    ? array_slice($game->moves, 0, 3)
                    : 'No moves data'
            ]);

            if ($moveCount < $minMoves) {
                return [
                    'allowed' => false,
                    'reason' => "At least {$minMoves} moves required before offering draw (current: {$moveCount})"
                ];
            }
        }

        // Check for existing pending offer
        $existingOffer = $this->getPendingDrawOffer($game->id);
        if ($existingOffer) {
            return [
                'allowed' => false,
                'reason' => 'Draw offer already pending'
            ];
        }

        return [
            'allowed' => true,
            'reason' => null
        ];
    }
}
