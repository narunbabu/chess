<?php

namespace App\Http\Controllers;

use App\Models\MatchmakingEntry;
use App\Services\MatchmakingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class MatchmakingController extends Controller
{
    private MatchmakingService $matchmaking;

    public function __construct(MatchmakingService $matchmaking)
    {
        $this->matchmaking = $matchmaking;
    }

    /**
     * POST /api/v1/matchmaking/join
     *
     * Enter the matchmaking queue.
     */
    public function join(Request $request)
    {
        $validated = $request->validate([
            'preferred_color' => 'nullable|in:white,black,random',
            'time_control_minutes' => 'nullable|integer|in:3,5,10,15,30',
            'increment_seconds' => 'nullable|integer|in:0,1,2,3,5,10',
            'game_mode' => 'nullable|in:casual,rated',
        ]);

        $user = Auth::user();

        $entry = $this->matchmaking->joinQueue($user, $validated);

        return response()->json([
            'message' => 'Joined matchmaking queue',
            'entry' => $this->formatEntry($entry),
        ]);
    }

    /**
     * GET /api/v1/matchmaking/status/{id}
     *
     * Poll the status of a matchmaking entry.
     */
    public function status(Request $request, int $id)
    {
        $entry = MatchmakingEntry::where('id', $id)
            ->where('user_id', Auth::id())
            ->firstOrFail();

        $entry = $this->matchmaking->checkStatus($entry);

        return response()->json([
            'entry' => $this->formatEntry($entry),
        ]);
    }

    /**
     * DELETE /api/v1/matchmaking/cancel/{id}
     *
     * Leave the matchmaking queue.
     */
    public function cancel(Request $request, int $id)
    {
        $entry = MatchmakingEntry::where('id', $id)
            ->where('user_id', Auth::id())
            ->firstOrFail();

        $entry = $this->matchmaking->cancelQueue($entry);

        return response()->json([
            'message' => 'Matchmaking cancelled',
            'entry' => $this->formatEntry($entry),
        ]);
    }

    // ─── Smart Real-User Matchmaking ────────────────────────────────────────

    /**
     * POST /api/v1/matchmaking/find-players
     *
     * Start smart matchmaking: find real online players and send them match requests.
     */
    public function findPlayers(Request $request)
    {
        $validated = $request->validate([
            'preferred_color' => 'nullable|in:white,black,random',
            'time_control_minutes' => 'nullable|integer|in:3,5,10,15,30',
            'increment_seconds' => 'nullable|integer|in:0,1,2,3,5,10',
            'game_mode' => 'nullable|in:casual,rated',
        ]);

        $user = Auth::user();
        $matchRequest = $this->matchmaking->findAndBroadcastPlayers($user, $validated);

        return response()->json([
            'message' => 'Match request created',
            'match_request' => [
                'token' => $matchRequest->token,
                'status' => $matchRequest->status,
                'targets_count' => $matchRequest->targets->count(),
                'expires_at' => $matchRequest->expires_at->toISOString(),
            ],
        ]);
    }

    /**
     * POST /api/v1/matchmaking/accept/{token}
     *
     * Accept a match request (called by a target player).
     */
    public function acceptRequest(Request $request, string $token)
    {
        try {
            $result = $this->matchmaking->acceptMatchRequest($token, Auth::user());

            $game = $result['game'];

            return response()->json([
                'message' => 'Match request accepted',
                'game' => [
                    'id' => $game->id,
                    'white_player_id' => $game->white_player_id,
                    'black_player_id' => $game->black_player_id,
                    'time_control_minutes' => $game->time_control_minutes,
                    'increment_seconds' => $game->increment_seconds,
                ],
            ]);
        } catch (\RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 409);
        }
    }

    /**
     * POST /api/v1/matchmaking/decline/{token}
     *
     * Decline a match request (called by a target player).
     */
    public function declineRequest(Request $request, string $token)
    {
        try {
            $this->matchmaking->declineMatchRequest($token, Auth::user());

            return response()->json(['message' => 'Match request declined']);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['error' => 'Match request not found or already resolved.'], 404);
        }
    }

    /**
     * POST /api/v1/matchmaking/cancel-find/{token}
     *
     * Cancel a match request (called by the requester).
     */
    public function cancelFind(Request $request, string $token)
    {
        try {
            $this->matchmaking->cancelMatchRequest($token, Auth::user());

            return response()->json(['message' => 'Match request cancelled']);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['error' => 'Match request not found or already resolved.'], 404);
        }
    }

    /**
     * Format a matchmaking entry for the API response.
     */
    private function formatEntry(MatchmakingEntry $entry): array
    {
        $data = [
            'id' => $entry->id,
            'status' => $entry->status,
            'rating' => $entry->rating,
            'queued_at' => $entry->queued_at->toISOString(),
            'expires_at' => $entry->expires_at->toISOString(),
            'matched_at' => $entry->matched_at?->toISOString(),
            'game_id' => $entry->game_id,
        ];

        if ($entry->status === 'matched') {
            if ($entry->matched_with_user_id) {
                $data['match_type'] = 'human';
                $data['opponent'] = $entry->matchedUser ? [
                    'id' => $entry->matchedUser->id,
                    'name' => $entry->matchedUser->name,
                    'rating' => $entry->matchedUser->rating ?? 1200,
                    'avatar' => $entry->matchedUser->google_avatar ?? $entry->matchedUser->avatar,
                ] : null;
            } elseif ($entry->matched_with_synthetic_id) {
                $data['match_type'] = 'synthetic';
                $data['opponent'] = $entry->matchedSynthetic ? [
                    'id' => $entry->matchedSynthetic->id,
                    'name' => $entry->matchedSynthetic->name,
                    'rating' => $entry->matchedSynthetic->rating,
                    'computer_level' => $entry->matchedSynthetic->computer_level,
                    'personality' => $entry->matchedSynthetic->personality,
                    'avatar_url' => $entry->matchedSynthetic->avatar_url,
                ] : null;
            }
        }

        return $data;
    }
}
