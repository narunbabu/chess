<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\ChampionshipMatch;
use App\Models\GameHistory;
use App\Services\RedisStatusService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * ContextualPresenceController
 *
 * Smart presence tracking that only checks users relevant to the current context:
 * - Friends/Contacts (people you've played with)
 * - Current round opponents (championship matches)
 * - Lobby users (paginated for challenges)
 *
 * Reduces unnecessary status checks by 95%+
 */
class ContextualPresenceController extends Controller
{
    protected RedisStatusService $redisStatus;

    public function __construct(RedisStatusService $redisStatus)
    {
        $this->redisStatus = $redisStatus;
    }

    /**
     * Get online status for user's friends/contacts
     * Friends = people you've played games with before
     *
     * @return JsonResponse
     */
    public function getFriendsStatus(): JsonResponse
    {
        try {
            $user = Auth::user();

            // Get all users the current user has played games with
            $friendIds = DB::table('game_history')
                ->where(function($query) use ($user) {
                    $query->where('player1_id', $user->id)
                          ->orWhere('player2_id', $user->id);
                })
                ->get()
                ->flatMap(function($game) use ($user) {
                    return [
                        $game->player1_id == $user->id ? $game->player2_id : $game->player1_id
                    ];
                })
                ->unique()
                ->filter()
                ->values()
                ->toArray();

            // Also include users from friendship table if it exists
            $friendshipIds = DB::table('friendships')
                ->where(function($query) use ($user) {
                    $query->where('user_id', $user->id)
                          ->orWhere('friend_id', $user->id);
                })
                ->where('status', 'accepted')
                ->get()
                ->map(function($friendship) use ($user) {
                    return $friendship->user_id == $user->id
                        ? $friendship->friend_id
                        : $friendship->user_id;
                })
                ->unique()
                ->values()
                ->toArray();

            // Merge and deduplicate
            $allFriendIds = array_unique(array_merge($friendIds, $friendshipIds));

            if (empty($allFriendIds)) {
                return response()->json([
                    'success' => true,
                    'data' => [
                        'friends' => [],
                        'online_count' => 0,
                        'total_count' => 0
                    ]
                ]);
            }

            // Get friend details with online status
            $friends = $this->getUsersWithStatus($allFriendIds);

            // Sort: online first, then by name
            $friends = collect($friends)->sortBy([
                ['is_online', 'desc'],
                ['name', 'asc']
            ])->values();

            return response()->json([
                'success' => true,
                'data' => [
                    'friends' => $friends,
                    'online_count' => $friends->where('is_online', true)->count(),
                    'total_count' => $friends->count()
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Get friends status failed', [
                'error' => $e->getMessage(),
                'user_id' => Auth::id()
            ]);

            return response()->json([
                'error' => 'Server error',
                'message' => 'Failed to get friends status'
            ], 500);
        }
    }

    /**
     * Get online status for current round opponents in championships
     *
     * @return JsonResponse
     */
    public function getCurrentRoundOpponents(): JsonResponse
    {
        try {
            $user = Auth::user();

            // Get all active/pending matches for the current user
            // Note: Using status_id (FK) instead of virtual 'status' attribute
            // Status IDs: 1=pending, 2=in_progress, 3=completed, 4=cancelled
            $matches = ChampionshipMatch::where(function($query) use ($user) {
                    $query->where('player1_id', $user->id)
                          ->orWhere('player2_id', $user->id);
                })
                ->whereIn('status_id', [1, 2]) // pending or in_progress
                ->whereNull('winner_id')
                ->with(['player1:id,name', 'player2:id,name', 'championship:id,title'])
                ->get();

            if ($matches->isEmpty()) {
                return response()->json([
                    'success' => true,
                    'data' => [
                        'opponents' => [],
                        'online_count' => 0,
                        'total_count' => 0
                    ]
                ]);
            }

            // Extract opponent IDs
            $opponentIds = $matches->map(function($match) use ($user) {
                return $match->player1_id == $user->id
                    ? $match->player2_id
                    : $match->player1_id;
            })->unique()->filter()->values()->toArray();

            // Get online statuses (Redis or DB)
            $redisAvailable = $this->redisStatus->isAvailable();
            Log::info('Opponent status check', [
                'user_id' => $user->id,
                'opponent_ids' => $opponentIds,
                'redis_available' => $redisAvailable
            ]);

            $statuses = $redisAvailable
                ? $this->redisStatus->batchCheck($opponentIds)
                : $this->getDatabaseStatuses($opponentIds);

            Log::info('Opponent statuses retrieved', [
                'user_id' => $user->id,
                'statuses' => $statuses
            ]);

            // Build opponent list with match context
            $opponents = $matches->map(function($match) use ($user, $statuses) {
                $opponent = $match->player1_id == $user->id
                    ? $match->player2  // Fixed: Get the OTHER player
                    : $match->player1; // Fixed: Get the OTHER player

                $opponentId = $opponent->id;

                return [
                    'user_id' => $opponentId,
                    'name' => $opponent->name,
                    'is_online' => $statuses[$opponentId] ?? false,
                    'championship' => [
                        'id' => $match->championship->id,
                        'title' => $match->championship->title
                    ],
                    'match' => [
                        'id' => $match->id,
                        'round' => $match->round,
                        'status' => $match->status,
                        'scheduled_at' => $match->scheduled_at?->toIso8601String()
                    ]
                ];
            });

            // Sort: online first
            $opponents = $opponents->sortBy([
                ['is_online', 'desc'],
                ['name', 'asc']
            ])->values();

            return response()->json([
                'success' => true,
                'data' => [
                    'opponents' => $opponents,
                    'online_count' => $opponents->where('is_online', true)->count(),
                    'total_count' => $opponents->count()
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Get current round opponents failed', [
                'error' => $e->getMessage(),
                'user_id' => Auth::id()
            ]);

            return response()->json([
                'error' => 'Server error',
                'message' => 'Failed to get opponents status'
            ], 500);
        }
    }

    /**
     * Get paginated list of online users for lobby
     * Perfect for "Challenge Random User" feature
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function getLobbyUsers(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'page' => 'integer|min:1',
                'per_page' => 'integer|min:5|max:50',
                'search' => 'string|nullable|max:100',
                'exclude_friends' => 'boolean'
            ]);

            $currentUser = Auth::user();
            $page = $validated['page'] ?? 1;
            $perPage = $validated['per_page'] ?? 20;
            $search = $validated['search'] ?? null;
            $excludeFriends = $validated['exclude_friends'] ?? false;

            // Get online user IDs from Redis (if available)
            if ($this->redisStatus->isAvailable()) {
                $onlineUserIds = $this->redisStatus->getOnlineUsers(1000);
            } else {
                // Fallback to database
                $onlineUserIds = User::where('last_activity_at', '>=', now()->subMinutes(5))
                    ->pluck('id')
                    ->toArray();
            }

            if (empty($onlineUserIds)) {
                return response()->json([
                    'success' => true,
                    'data' => [
                        'users' => [],
                        'pagination' => [
                            'current_page' => $page,
                            'per_page' => $perPage,
                            'total' => 0,
                            'total_pages' => 0,
                            'has_more' => false
                        ]
                    ]
                ]);
            }

            // Build query for online users
            $query = User::whereIn('id', $onlineUserIds)
                ->where('id', '!=', $currentUser->id) // Exclude self
                ->select('id', 'name', 'last_activity_at');

            // Optional: Exclude friends
            if ($excludeFriends) {
                $friendIds = DB::table('game_history')
                    ->where(function($q) use ($currentUser) {
                        $q->where('player1_id', $currentUser->id)
                          ->orWhere('player2_id', $currentUser->id);
                    })
                    ->get()
                    ->flatMap(function($game) use ($currentUser) {
                        return [
                            $game->player1_id == $currentUser->id ? $game->player2_id : $game->player1_id
                        ];
                    })
                    ->unique()
                    ->toArray();

                if (!empty($friendIds)) {
                    $query->whereNotIn('id', $friendIds);
                }
            }

            // Optional: Search filter
            if ($search) {
                $query->where('name', 'LIKE', "%{$search}%");
            }

            // Get total count
            $total = $query->count();

            // Paginate
            $offset = ($page - 1) * $perPage;
            $users = $query->orderBy('last_activity_at', 'desc')
                ->offset($offset)
                ->limit($perPage)
                ->get();

            // Add online status (always true since we filtered by online users)
            $users = $users->map(function($user) {
                return [
                    'user_id' => $user->id,
                    'name' => $user->name,
                    'is_online' => true,
                    'last_seen' => $user->last_activity_at->diffForHumans()
                ];
            });

            $totalPages = ceil($total / $perPage);

            return response()->json([
                'success' => true,
                'data' => [
                    'users' => $users,
                    'pagination' => [
                        'current_page' => $page,
                        'per_page' => $perPage,
                        'total' => $total,
                        'total_pages' => $totalPages,
                        'has_more' => $page < $totalPages
                    ]
                ]
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'error' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);

        } catch (\Exception $e) {
            Log::error('Get lobby users failed', [
                'error' => $e->getMessage(),
                'user_id' => Auth::id()
            ]);

            return response()->json([
                'error' => 'Server error',
                'message' => 'Failed to get lobby users'
            ], 500);
        }
    }

    /**
     * Get combined contextual presence
     * Returns all relevant users in one request
     *
     * @return JsonResponse
     */
    public function getContextualPresence(): JsonResponse
    {
        try {
            $user = Auth::user();

            // Collect all relevant user IDs
            $relevantUserIds = collect();

            // 1. Friends/Contacts
            $friendIds = DB::table('game_history')
                ->where(function($query) use ($user) {
                    $query->where('player1_id', $user->id)
                          ->orWhere('player2_id', $user->id);
                })
                ->get()
                ->flatMap(function($game) use ($user) {
                    return [
                        $game->player1_id == $user->id ? $game->player2_id : $game->player1_id
                    ];
                })
                ->unique();

            $relevantUserIds = $relevantUserIds->merge($friendIds);

            // 2. Current round opponents
            // Note: Using status_id (FK) instead of virtual 'status' attribute
            $opponentIds = ChampionshipMatch::where(function($query) use ($user) {
                    $query->where('player1_id', $user->id)
                          ->orWhere('player2_id', $user->id);
                })
                ->whereIn('status_id', [1, 2]) // pending or in_progress
                ->whereNull('winner_id')
                ->get()
                ->map(function($match) use ($user) {
                    return $match->player1_id == $user->id
                        ? $match->player2_id
                        : $match->player1_id;
                })
                ->unique();

            $relevantUserIds = $relevantUserIds->merge($opponentIds);

            // Remove duplicates and current user
            $relevantUserIds = $relevantUserIds->unique()
                ->filter()
                ->reject(fn($id) => $id == $user->id)
                ->values()
                ->toArray();

            if (empty($relevantUserIds)) {
                return response()->json([
                    'success' => true,
                    'data' => [
                        'users' => [],
                        'online_count' => 0,
                        'total_count' => 0
                    ]
                ]);
            }

            // Get users with online status
            $users = $this->getUsersWithStatus($relevantUserIds);

            // Categorize users
            $friends = $users->whereIn('user_id', $friendIds->toArray())->values();
            $opponents = $users->whereIn('user_id', $opponentIds->toArray())->values();

            return response()->json([
                'success' => true,
                'data' => [
                    'friends' => $friends,
                    'opponents' => $opponents,
                    'all_users' => $users,
                    'online_count' => $users->where('is_online', true)->count(),
                    'total_count' => $users->count()
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Get contextual presence failed', [
                'error' => $e->getMessage(),
                'user_id' => Auth::id()
            ]);

            return response()->json([
                'error' => 'Server error',
                'message' => 'Failed to get contextual presence'
            ], 500);
        }
    }

    /**
     * Helper: Get users with online status
     *
     * @param array $userIds
     * @return \Illuminate\Support\Collection
     */
    private function getUsersWithStatus(array $userIds)
    {
        if (empty($userIds)) {
            return collect();
        }

        // Get online statuses (Redis or DB)
        $statuses = $this->redisStatus->isAvailable()
            ? $this->redisStatus->batchCheck($userIds)
            : $this->getDatabaseStatuses($userIds);

        // Get user details
        $users = User::whereIn('id', $userIds)
            ->select('id', 'name', 'last_activity_at')
            ->get();

        return $users->map(function($user) use ($statuses) {
            return [
                'user_id' => $user->id,
                'name' => $user->name,
                'is_online' => $statuses[$user->id] ?? false,
                'last_seen' => $user->last_activity_at?->diffForHumans()
            ];
        });
    }

    /**
     * Helper: Get database statuses (fallback)
     *
     * @param array $userIds
     * @return array
     */
    private function getDatabaseStatuses(array $userIds): array
    {
        $threshold = now()->subMinutes(5);

        $onlineUsers = User::whereIn('id', $userIds)
            ->where('last_activity_at', '>=', $threshold)
            ->pluck('id')
            ->toArray();

        $statuses = [];
        foreach ($userIds as $userId) {
            $statuses[$userId] = in_array($userId, $onlineUsers);
        }

        return $statuses;
    }
}
