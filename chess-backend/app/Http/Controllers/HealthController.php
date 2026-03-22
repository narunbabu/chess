<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\GameStatus;
use App\Models\MatchmakingEntry;
use App\Models\MatchRequest;
use App\Models\UserPresence;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class HealthController extends Controller
{
    /**
     * API health check endpoint.
     * Returns server status, API version, and minimum supported app versions.
     */
    public function index(): JsonResponse
    {
        $dbHealthy = true;
        try {
            DB::connection()->getPdo();
        } catch (\Exception $e) {
            $dbHealthy = false;
        }

        return response()->json([
            'status' => $dbHealthy ? 'healthy' : 'degraded',
            'api_version' => 'v1',
            'min_supported_app_version' => [
                'android' => '1.0.0',
                'ios' => '1.0.0',
            ],
            'features' => [
                'websocket' => true,
                'push_notifications' => true,
                'apple_sign_in' => true,
                'google_sign_in' => true,
            ],
            'server_time' => now()->toIso8601String(),
        ]);
    }

    /**
     * Detailed platform status: online players, active games, Reverb connection,
     * matchmaking stats, and recent match history.
     */
    public function status(): JsonResponse
    {
        $dbHealthy = true;
        try {
            DB::connection()->getPdo();
        } catch (\Exception $e) {
            $dbHealthy = false;
        }

        // ── Online players ──────────────────────────────────────────────────
        $stronglyOnline = UserPresence::whereIn('status', ['online', 'away'])
            ->where('last_activity', '>=', now()->subMinutes(2))
            ->whereNotNull('socket_id')
            ->count();

        $recentlyActive = UserPresence::whereIn('status', ['online', 'away'])
            ->where('last_activity', '>=', now()->subMinutes(5))
            ->count();

        $onlineWithSocket = UserPresence::where('status', 'online')
            ->whereNotNull('socket_id')
            ->where('last_activity', '>=', now()->subMinutes(5))
            ->get(['user_id', 'status', 'last_activity', 'socket_id'])
            ->map(fn ($p) => [
                'user_id' => $p->user_id,
                'status' => $p->status,
                'last_activity' => $p->last_activity?->toIso8601String(),
                'has_socket' => $p->socket_id !== null,
            ]);

        // ── Active games ────────────────────────────────────────────────────
        $activeStatusId = GameStatus::where('code', 'active')->value('id');
        $activeGames = $activeStatusId
            ? Game::where('status_id', $activeStatusId)
                ->where('result', 'ongoing')
                ->count()
            : 0;

        $activeHumanGames = $activeStatusId
            ? Game::where('status_id', $activeStatusId)
                ->where('result', 'ongoing')
                ->whereNull('computer_player_id')
                ->count()
            : 0;

        $activeComputerGames = $activeGames - $activeHumanGames;

        // ── Reverb/WebSocket status ─────────────────────────────────────────
        $reverbHealthy = false;
        $reverbError = null;
        try {
            $reverbHost = config('reverb.servers.reverb.host', '0.0.0.0');
            $reverbPort = (int) config('reverb.servers.reverb.port', 8080);
            // 0.0.0.0 is a listen address, not connectable — probe 127.0.0.1 instead
            $probeHost = $reverbHost === '0.0.0.0' ? '127.0.0.1' : $reverbHost;
            $fp = @fsockopen($probeHost, $reverbPort, $errno, $errstr, 2);
            if ($fp) {
                $reverbHealthy = true;
                fclose($fp);
            } else {
                $reverbError = "{$errstr} (errno: {$errno})";
            }
        } catch (\Exception $e) {
            $reverbError = $e->getMessage();
        }

        // ── Matchmaking stats ───────────────────────────────────────────────
        $currentlySearching = MatchmakingEntry::where('status', 'searching')
            ->where('expires_at', '>=', now())
            ->count();

        $pendingSmartMatches = MatchRequest::where('status', 'searching')
            ->where('expires_at', '>=', now())
            ->count();

        // ── Recent match history (last 10) ──────────────────────────────────
        $recentMatches = MatchRequest::with(['requester:id,name', 'targets'])
            ->whereIn('status', ['accepted', 'expired', 'cancelled'])
            ->orderByDesc('created_at')
            ->limit(10)
            ->get()
            ->map(fn ($mr) => [
                'token' => substr($mr->token, 0, 8) . '...',
                'requester' => $mr->requester?->name ?? 'Unknown',
                'status' => $mr->status,
                'targets_count' => $mr->targets->count(),
                'accepted_targets' => $mr->targets->where('status', 'accepted')->count(),
                'declined_targets' => $mr->targets->where('status', 'declined')->count(),
                'expired_targets' => $mr->targets->where('status', 'expired')->count(),
                'game_id' => $mr->game_id,
                'created_at' => $mr->created_at->toIso8601String(),
                'age' => $mr->created_at->diffForHumans(),
            ]);

        $recentQueueMatches = MatchmakingEntry::where('status', 'matched')
            ->orderByDesc('matched_at')
            ->limit(10)
            ->get()
            ->map(fn ($e) => [
                'user_id' => $e->user_id,
                'match_type' => $e->matched_with_synthetic_id ? 'synthetic' : 'human',
                'game_id' => $e->game_id,
                'matched_at' => $e->matched_at?->toIso8601String(),
                'age' => $e->matched_at?->diffForHumans(),
            ]);

        return response()->json([
            'status' => $dbHealthy ? 'healthy' : 'degraded',
            'server_time' => now()->toIso8601String(),

            'players' => [
                'strongly_online' => $stronglyOnline,
                'recently_active' => $recentlyActive,
                'online_details' => $onlineWithSocket,
            ],

            'games' => [
                'active_total' => $activeGames,
                'active_human' => $activeHumanGames,
                'active_computer' => $activeComputerGames,
            ],

            'reverb' => [
                'status' => $reverbHealthy ? 'connected' : 'disconnected',
                'host' => config('reverb.servers.reverb.host', '0.0.0.0'),
                'port' => (int) config('reverb.servers.reverb.port', 8080),
                'error' => $reverbError,
            ],

            'matchmaking' => [
                'currently_searching' => $currentlySearching,
                'pending_smart_matches' => $pendingSmartMatches,
            ],

            'recent_smart_matches' => $recentMatches,
            'recent_queue_matches' => $recentQueueMatches,
        ]);
    }
}
