<?php

namespace App\Observers;

use App\Models\TacticalPuzzleAttempt;
use App\Models\User;
use App\Services\ReferralService;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * On a successful tactical puzzle attempt by a referred user, record:
 *   1. first_activity (₹3) — once per referred user, fires the first time
 *      *any* activity (a rated game OR a solved puzzle) happens
 *   2. activity_100 (₹5) — once per referred user, fires when
 *      games_played + unique_puzzles_solved ≥ 100
 *
 * recordMilestone() is idempotent, so duplicate calls are safe.
 */
class TacticalPuzzleAttemptObserver
{
    public function __construct(protected ReferralService $referralService) {}

    public function created(TacticalPuzzleAttempt $attempt): void
    {
        if (!$attempt->success) {
            return;
        }

        $user = $attempt->user;
        if (!$user || !$user->referred_by_user_id) {
            return;
        }

        try {
            $this->referralService->recordMilestone(
                $user, 'first_activity', $attempt->id
            );

            $combined = (int) ($user->games_played ?? 0)
                + (int) DB::table('user_tactical_stats')
                    ->where('user_id', $user->id)
                    ->value('total_solved');

            if ($combined >= ReferralService::ACTIVITY_100_THRESHOLD) {
                $this->referralService->recordMilestone(
                    $user, 'activity_100', $attempt->id
                );
            }
        } catch (Throwable $e) {
            report($e);
        }
    }
}
