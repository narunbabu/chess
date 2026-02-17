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
            'increment_seconds' => 'nullable|integer|in:0,2,3,5,10',
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
