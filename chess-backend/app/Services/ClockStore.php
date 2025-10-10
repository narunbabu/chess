<?php

namespace App\Services;

use App\Models\Game;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Log;

/**
 * ClockStore - Clock State Management
 *
 * Manages clock state persistence using Redis (if available) for speed and DB for durability.
 * Implements a write-behind pattern where Redis is the hot path and DB is
 * periodically synchronized. Falls back to DB-only mode if Redis is unavailable.
 *
 * Redis Key Structure:
 * - game:{id}:clock -> Hash with white_ms, black_ms, running, last_server_ms, etc.
 */
class ClockStore
{
    protected ClockService $clockService;
    protected bool $redisAvailable = false;

    public function __construct(ClockService $clockService)
    {
        $this->clockService = $clockService;
        $this->checkRedisAvailability();
    }

    /**
     * Check if Redis is available
     */
    protected function checkRedisAvailability(): void
    {
        try {
            // Test Redis connection
            Redis::ping();
            $this->redisAvailable = true;
            Log::info('ClockStore: Redis is available');
        } catch (\Exception $e) {
            $this->redisAvailable = false;
            Log::warning('ClockStore: Redis unavailable, using DB-only mode', [
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Get Redis key for game clock
     */
    protected function getClockKey(int $gameId): string
    {
        return "game:{$gameId}:clock";
    }

    /**
     * Load clock state from Redis (with DB fallback)
     *
     * @param int $gameId Game ID
     * @return array|null Clock state or null if not found
     */
    public function load(int $gameId): ?array
    {
        // Try Redis first if available
        if ($this->redisAvailable) {
            try {
                $key = $this->getClockKey($gameId);
                $data = Redis::hgetall($key);

                if (!empty($data)) {
                    // Convert string values to proper types
                    return $this->deserialize($data);
                }
            } catch (\Exception $e) {
                Log::warning("Redis load failed for game {$gameId}, falling back to DB", [
                    'error' => $e->getMessage()
                ]);
                $this->redisAvailable = false;
            }
        }

        // Fallback to DB (or DB-only mode)
        $game = Game::find($gameId);
        if (!$game) {
            return null;
        }

        // Build clock state from DB
        $clock = [
            'white_ms' => $game->white_ms ?? 600000,
            'black_ms' => $game->black_ms ?? 600000,
            'running' => $game->running,
            'last_server_ms' => $game->last_server_ms ?? $this->clockService->nowMs(),
            'increment_ms' => $game->increment_ms ?? 0,
            'status' => $game->status ?? 'active',
            'reason' => $game->end_reason,
            'revision' => $game->revision ?? 0,
        ];

        // Cache in Redis if available
        if ($this->redisAvailable) {
            $this->save($gameId, $clock, false); // Don't write back to DB
        }

        return $clock;
    }

    /**
     * Save clock state to Redis (and optionally DB)
     *
     * @param int $gameId Game ID
     * @param array $clock Clock state
     * @param bool $persistToDb Whether to write to database immediately
     * @return bool Success
     */
    public function save(int $gameId, array $clock, bool $persistToDb = false): bool
    {
        // Validate before saving
        if (!$this->clockService->isValid($clock)) {
            Log::error("Invalid clock state for game {$gameId}", $clock);
            return false;
        }

        // Save to Redis if available
        if ($this->redisAvailable) {
            try {
                $key = $this->getClockKey($gameId);
                $serialized = $this->serialize($clock);
                Redis::hmset($key, $serialized);

                // Set TTL (expire inactive games after 24 hours)
                Redis::expire($key, 86400);
            } catch (\Exception $e) {
                Log::warning("Redis save failed for game {$gameId}, continuing with DB-only", [
                    'error' => $e->getMessage()
                ]);
                $this->redisAvailable = false;
                // Continue to DB persist below
                $persistToDb = true; // Force DB save if Redis fails
            }
        } else {
            // DB-only mode: always persist
            $persistToDb = true;
        }

        // Persist to DB immediately if requested or in DB-only mode
        if ($persistToDb) {
            return $this->persistToDatabase($gameId, $clock);
        }

        return true;
    }

    /**
     * Update clock and increment revision
     *
     * @param int $gameId Game ID
     * @param array $clock Updated clock state
     * @param bool $persistToDb Whether to write to database immediately
     * @return array Clock state with updated revision
     */
    public function updateWithRevision(int $gameId, array $clock, bool $persistToDb = false): array
    {
        // Increment revision for WebSocket ordering
        $clock['revision'] = ($clock['revision'] ?? 0) + 1;

        $this->save($gameId, $clock, $persistToDb);

        return $clock;
    }

    /**
     * Persist clock state to database
     *
     * @param int $gameId Game ID
     * @param array $clock Clock state
     * @return bool Success
     */
    public function persistToDatabase(int $gameId, array $clock): bool
    {
        $game = Game::find($gameId);
        if (!$game) {
            return false;
        }

        $game->white_ms = $clock['white_ms'];
        $game->black_ms = $clock['black_ms'];
        $game->running = $clock['running'];
        $game->last_server_ms = $clock['last_server_ms'];
        $game->increment_ms = $clock['increment_ms'] ?? 0;
        $game->revision = $clock['revision'] ?? 0;

        // Update game status if clock indicates game over
        if (($clock['status'] ?? 'active') === 'over') {
            $game->status = 'finished';
            if (!empty($clock['reason'])) {
                $game->end_reason = $clock['reason'];
            }
            if (!empty($clock['winner'])) {
                $game->winner_player = $clock['winner'];
            }
            $game->ended_at = now();
        }

        return $game->save();
    }

    /**
     * Delete clock state from Redis
     *
     * @param int $gameId Game ID
     * @return bool Success
     */
    public function delete(int $gameId): bool
    {
        if (!$this->redisAvailable) {
            return true; // Nothing to delete in DB-only mode
        }

        try {
            $key = $this->getClockKey($gameId);
            return Redis::del($key) > 0;
        } catch (\Exception $e) {
            Log::warning("Redis delete failed for game {$gameId}", [
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Get all active game IDs (games with running clocks)
     *
     * @return array Array of game IDs
     */
    public function getActiveGameIds(): array
    {
        if ($this->redisAvailable) {
            try {
                // Pattern match all game clock keys
                $pattern = "game:*:clock";
                $keys = Redis::keys($pattern);

                $gameIds = [];
                foreach ($keys as $key) {
                    // Extract game ID from "game:{id}:clock"
                    if (preg_match('/game:(\d+):clock/', $key, $matches)) {
                        $gameId = (int) $matches[1];

                        // Check if clock is actually running
                        $running = Redis::hget($key, 'running');
                        $status = Redis::hget($key, 'status');

                        if (!empty($running) && $status === 'active') {
                            $gameIds[] = $gameId;
                        }
                    }
                }

                return $gameIds;
            } catch (\Exception $e) {
                Log::warning('Redis getActiveGameIds failed, falling back to DB query', [
                    'error' => $e->getMessage()
                ]);
                $this->redisAvailable = false;
            }
        }

        // DB-only mode: query active games
        return Game::where('status', 'active')
            ->whereNotNull('running')
            ->pluck('id')
            ->toArray();
    }

    /**
     * Serialize clock state for Redis storage
     *
     * @param array $clock Clock state
     * @return array Serialized values (all strings)
     */
    protected function serialize(array $clock): array
    {
        return [
            'white_ms' => (string) ($clock['white_ms'] ?? 0),
            'black_ms' => (string) ($clock['black_ms'] ?? 0),
            'running' => $clock['running'] ?? '',
            'last_server_ms' => (string) ($clock['last_server_ms'] ?? 0),
            'increment_ms' => (string) ($clock['increment_ms'] ?? 0),
            'status' => $clock['status'] ?? 'active',
            'reason' => $clock['reason'] ?? '',
            'revision' => (string) ($clock['revision'] ?? 0),
        ];
    }

    /**
     * Deserialize clock state from Redis
     *
     * @param array $data Raw Redis hash data
     * @return array Clock state with proper types
     */
    protected function deserialize(array $data): array
    {
        return [
            'white_ms' => (int) ($data['white_ms'] ?? 0),
            'black_ms' => (int) ($data['black_ms'] ?? 0),
            'running' => !empty($data['running']) ? $data['running'] : null,
            'last_server_ms' => (int) ($data['last_server_ms'] ?? 0),
            'increment_ms' => (int) ($data['increment_ms'] ?? 0),
            'status' => $data['status'] ?? 'active',
            'reason' => !empty($data['reason']) ? $data['reason'] : null,
            'revision' => (int) ($data['revision'] ?? 0),
        ];
    }

    /**
     * Batch persist active games to database
     *
     * Called periodically to sync Redis state to DB.
     *
     * @param array $gameIds Optional list of game IDs (defaults to all active)
     * @return int Number of games persisted
     */
    public function batchPersist(array $gameIds = []): int
    {
        if (empty($gameIds)) {
            $gameIds = $this->getActiveGameIds();
        }

        $count = 0;
        foreach ($gameIds as $gameId) {
            $clock = $this->load($gameId);
            if ($clock && $this->persistToDatabase($gameId, $clock)) {
                $count++;
            }
        }

        return $count;
    }
}
