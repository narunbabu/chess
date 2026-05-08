<?php

namespace App\Listeners;

use App\Events\GameEndedEvent;
use App\Models\Game;
use App\Models\User;
use App\Services\ReferralService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * On every game-end broadcast, fire ambassador activity milestones for any
 * referred player on the board. We require:
 *   - real human player (no synthetic bot, no PlayComputer)
 *   - at least RATED_GAME_MIN_PLIES half-moves (filters resignation-spam)
 *
 * Both first_activity (₹3) and activity_100 (₹5) milestones are checked.
 * recordMilestone() is idempotent so we never double-pay.
 */
class RecordReferralActivityOnGameEnd
{
    public function __construct(protected ReferralService $referralService) {}

    public function handle(GameEndedEvent $event): void
    {
        try {
            $game = Game::find($event->gameId);
            if (!$game) {
                return;
            }

            // Only count rated human-vs-human games. Synthetic/companion games
            // and PlayComputer games are excluded.
            if ($game->synthetic_player_id || $game->computer_player_id) {
                return;
            }
            if (($game->move_count ?? 0) < ReferralService::RATED_GAME_MIN_PLIES) {
                return;
            }

            foreach ([$game->white_player_id, $game->black_player_id] as $playerId) {
                if (!$playerId) {
                    continue;
                }
                $user = User::find($playerId);
                if (!$user || !$user->referred_by_user_id) {
                    continue;
                }

                $this->referralService->recordMilestone(
                    $user, 'first_activity', $game->id
                );

                $combined = (int) ($user->games_played ?? 0)
                    + (int) DB::table('user_tactical_stats')
                        ->where('user_id', $user->id)
                        ->value('total_solved');

                if ($combined >= ReferralService::ACTIVITY_100_THRESHOLD) {
                    $this->referralService->recordMilestone(
                        $user, 'activity_100', $game->id
                    );
                }
            }
        } catch (Throwable $e) {
            // Don't let referral bookkeeping break the game-end broadcast.
            Log::error('RecordReferralActivityOnGameEnd failed', [
                'game_id' => $event->gameId,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
