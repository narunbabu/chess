<?php

namespace App\Observers;

use App\Models\Game;
use App\Models\GameEndReason;
use App\Models\GameStatus;
use App\Models\Invitation;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class GameObserver
{
    /**
     * End reasons that represent an abandoned/cancelled game rather than a
     * played one — these do not credit an activity-streak day.
     */
    private const NON_PLAY_END_REASONS = ['aborted', 'abandoned_mutual', 'cancelled_inactivity'];

    /**
     * Handle the Game "updated" event.
     * Clean up invitations and pause info when games are finished/aborted,
     * and credit activity streaks for both players when a game is played to
     * a terminal result.
     */
    public function updated(Game $game)
    {
        // Only act when status changes to terminal state.
        // `status` is a virtual attribute (its mutator writes the status_id
        // FK column), so the change is tracked under status_id — checking
        // both keys keeps this correct either way.
        if ($game->wasChanged('status_id') || $game->wasChanged('status')) {
            // Resolve the codes from the raw FK columns, NOT the accessors:
            // the status/end_reason accessors memoise their relation, which
            // is stale when it was loaded before this update (e.g. the
            // finalizeGame idempotency check).
            $newStatus = $this->statusCodeFor($game->status_id);
            $oldStatus = $this->statusCodeFor($game->getRawOriginal('status_id'));

            // Check if game just ended (became finished/aborted)
            if (in_array($newStatus, ['finished', 'aborted', 'completed']) &&
                !in_array($oldStatus, ['finished', 'aborted', 'completed'])) {

                Log::info('🧹 Game ended - cleaning up associated data', [
                    'game_id' => $game->id,
                    'old_status' => $oldStatus,
                    'new_status' => $newStatus,
                    'white_player' => $game->white_player_id,
                    'black_player' => $game->black_player_id
                ]);

                $this->cleanupInvitations($game);
                $this->cleanupResumeInfo($game);
                $this->creditActivityStreaks($game, $newStatus);
            }
        }
    }

    /**
     * Credit an activity-streak day to both human players when a game they
     * played reaches a terminal state. Aborted/cancelled games do NOT count.
     */
    private function creditActivityStreaks(Game $game, string $newStatus): void
    {
        if (!in_array($newStatus, ['finished', 'completed'])) {
            return; // aborted games never credit
        }

        // Mutual abandons and inactivity cancels land as status=finished but
        // carry the PGN no-result marker '*' — a played game always has a
        // real result (1-0 / 0-1 / 1/2-1/2).
        if ($game->result === '*') {
            return;
        }

        $endReason = $game->end_reason_id
            ? GameEndReason::find($game->end_reason_id)?->code
            : null;

        if (in_array($endReason, self::NON_PLAY_END_REASONS)) {
            return; // belt-and-braces: lookup-table codes for abort/abandon
        }

        $playerIds = collect([$game->white_player_id, $game->black_player_id])
            ->filter()
            ->unique()
            ->values();

        if ($playerIds->isEmpty()) {
            return;
        }

        $players = User::whereIn('id', $playerIds)->get();

        foreach ($players as $player) {
            try {
                $player->updateDailyStreak();
            } catch (\Exception $e) {
                Log::error('❌ Failed to update daily streak for player', [
                    'game_id' => $game->id,
                    'user_id' => $player->id,
                    'error' => $e->getMessage(),
                ]);
                // Continue — a streak update must never fail a game save
            }
        }
    }

    /**
     * Resolve a status code straight from the status_id FK (no accessor,
     * no relation memoisation).
     */
    private function statusCodeFor(?int $statusId): ?string
    {
        if ($statusId === null) {
            return null;
        }

        return GameStatus::find($statusId)?->code;
    }

    /**
     * Clean up all invitations associated with the completed game
     */
    private function cleanupInvitations(Game $game)
    {
        try {
            $deletedCount = Invitation::where('game_id', $game->id)->delete();

            Log::info('🗑️ Cleaned up invitations for completed game', [
                'game_id' => $game->id,
                'invitations_deleted' => $deletedCount
            ]);
        } catch (\Exception $e) {
            Log::error('❌ Failed to clean up invitations for game', [
                'game_id' => $game->id,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Clean up resume request info from the game
     */
    private function cleanupResumeInfo(Game $game)
    {
        try {
            if ($game->resume_requested_by || $game->resume_requested_at) {
                $game->update([
                    'resume_requested_by' => null,
                    'resume_requested_at' => null,
                    'resume_request_expires_at' => null
                ]);

                Log::info('🧹 Cleaned up resume request info from completed game', [
                    'game_id' => $game->id,
                    'was_requested_by' => $game->getOriginal('resume_requested_by'),
                    'was_requested_at' => $game->getOriginal('resume_requested_at')
                ]);
            }
        } catch (\Exception $e) {
            Log::error('❌ Failed to clean up resume info for game', [
                'game_id' => $game->id,
                'error' => $e->getMessage()
            ]);
        }
    }
}