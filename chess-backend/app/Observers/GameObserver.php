<?php

namespace App\Observers;

use App\Models\Game;
use App\Models\Invitation;
use Illuminate\Support\Facades\Log;

class GameObserver
{
    /**
     * Handle the Game "updated" event.
     * Clean up invitations and pause info when games are finished/aborted.
     */
    public function updated(Game $game)
    {
        // Only act when status changes to terminal state
        if ($game->wasChanged('status')) {
            $newStatus = $game->status;
            $oldStatus = $game->getOriginal('status');

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
            }
        }
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