<?php

namespace App\Services;

use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Log;

/**
 * RedisStatusService
 *
 * High-performance user online status tracking using Redis.
 * Designed to scale to 100,000+ concurrent users.
 *
 * Features:
 * - O(log n) lookups using sorted sets
 * - Automatic TTL expiration
 * - Batch operations for efficiency
 * - Memory-efficient storage
 * - Pub/Sub for real-time updates
 */
class RedisStatusService
{
    /**
     * Redis key for sorted set of online users
     * Score = timestamp of last activity
     */
    private const ONLINE_KEY = 'users:online';

    /**
     * Prefix for individual user activity keys
     */
    private const USER_ACTIVITY_PREFIX = 'user:activity:';

    /**
     * Prefix for championship presence sets
     */
    private const CHAMPIONSHIP_PREFIX = 'championship:presence:';

    /**
     * Online threshold in seconds (5 minutes)
     */
    private const ONLINE_THRESHOLD_SECONDS = 300;

    /**
     * Maximum batch size for operations
     */
    private const MAX_BATCH_SIZE = 100;

    /**
     * Mark user as online with current timestamp
     *
     * @param int $userId
     * @param int|null $championshipId Optional - track in championship context
     * @return void
     */
    public function markOnline(int $userId, ?int $championshipId = null): void
    {
        try {
            $timestamp = time();

            // Add to global sorted set
            Redis::zadd(self::ONLINE_KEY, $timestamp, $userId);

            // Set individual key with TTL (auto-expires)
            Redis::setex(
                self::USER_ACTIVITY_PREFIX . $userId,
                self::ONLINE_THRESHOLD_SECONDS,
                $timestamp
            );

            Log::debug('User marked online in Redis', [
                'user_id' => $userId,
                'timestamp' => $timestamp,
                'championship_id' => $championshipId
            ]);

            // If championship context provided, track there too
            if ($championshipId) {
                $key = self::CHAMPIONSHIP_PREFIX . $championshipId;
                Redis::zadd($key, $timestamp, $userId);
                Redis::expire($key, 3600); // Championship presence expires after 1 hour
            }

            // Publish status change for real-time updates
            Redis::publish('user:status:change', json_encode([
                'user_id' => $userId,
                'is_online' => true,
                'timestamp' => $timestamp,
                'championship_id' => $championshipId
            ]));

        } catch (\Exception $e) {
            Log::error('Redis markOnline failed', [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);

            // Don't throw - degrade gracefully
        }
    }

    /**
     * Check if a single user is online
     *
     * @param int $userId
     * @return bool
     */
    public function isOnline(int $userId): bool
    {
        try {
            $key = self::USER_ACTIVITY_PREFIX . $userId;
            return Redis::exists($key) > 0;

        } catch (\Exception $e) {
            Log::error('Redis isOnline failed', [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);

            return false; // Conservative fallback
        }
    }

    /**
     * Batch check multiple users' online status
     * Efficient pipeline operation - O(n) but in-memory
     *
     * @param array $userIds
     * @return array Map of user_id => is_online
     */
    public function batchCheck(array $userIds): array
    {
        if (empty($userIds)) {
            return [];
        }

        // Enforce batch size limit
        if (count($userIds) > self::MAX_BATCH_SIZE) {
            Log::warning('Batch check exceeds limit', [
                'requested' => count($userIds),
                'limit' => self::MAX_BATCH_SIZE
            ]);

            $userIds = array_slice($userIds, 0, self::MAX_BATCH_SIZE);
        }

        try {
            // Use pipeline for efficient batch operation
            $pipeline = Redis::pipeline();

            foreach ($userIds as $userId) {
                $key = self::USER_ACTIVITY_PREFIX . $userId;
                $pipeline->exists($key);
            }

            $results = $pipeline->execute();

            // Convert to associative array
            $statuses = [];
            foreach ($userIds as $index => $userId) {
                $statuses[$userId] = $results[$index] > 0;
            }

            Log::debug('Batch check results', [
                'user_ids' => $userIds,
                'statuses' => $statuses,
                'online_count' => count(array_filter($statuses))
            ]);

            return $statuses;

        } catch (\Exception $e) {
            Log::error('Redis batchCheck failed', [
                'user_count' => count($userIds),
                'error' => $e->getMessage()
            ]);

            // Return all offline as fallback
            return array_fill_keys($userIds, false);
        }
    }

    /**
     * Get all online users (with limit for safety)
     * Uses sorted set range query - O(log n)
     *
     * @param int $limit Maximum number of users to return
     * @param int $offset Pagination offset
     * @return array Array of user IDs
     */
    public function getOnlineUsers(int $limit = 1000, int $offset = 0): array
    {
        try {
            $threshold = time() - self::ONLINE_THRESHOLD_SECONDS;

            // Get users active since threshold, ordered by activity
            $userIds = Redis::zrangebyscore(
                self::ONLINE_KEY,
                $threshold,
                '+inf',
                [
                    'limit' => [$offset, $limit]
                ]
            );

            return array_map('intval', $userIds);

        } catch (\Exception $e) {
            Log::error('Redis getOnlineUsers failed', [
                'error' => $e->getMessage()
            ]);

            return [];
        }
    }

    /**
     * Get count of online users
     * Very efficient - O(log n)
     *
     * @return int
     */
    public function getOnlineCount(): int
    {
        try {
            $threshold = time() - self::ONLINE_THRESHOLD_SECONDS;

            return Redis::zcount(self::ONLINE_KEY, $threshold, '+inf');

        } catch (\Exception $e) {
            Log::error('Redis getOnlineCount failed', [
                'error' => $e->getMessage()
            ]);

            return 0;
        }
    }

    /**
     * Get online users for a specific championship
     * Scoped presence tracking
     *
     * @param int $championshipId
     * @return array Array of user IDs
     */
    public function getChampionshipOnlineUsers(int $championshipId): array
    {
        try {
            $key = self::CHAMPIONSHIP_PREFIX . $championshipId;
            $threshold = time() - self::ONLINE_THRESHOLD_SECONDS;

            $userIds = Redis::zrangebyscore($key, $threshold, '+inf');

            return array_map('intval', $userIds);

        } catch (\Exception $e) {
            Log::error('Redis getChampionshipOnlineUsers failed', [
                'championship_id' => $championshipId,
                'error' => $e->getMessage()
            ]);

            return [];
        }
    }

    /**
     * Clean up old entries from sorted set
     * Should be run periodically (e.g., every 5 minutes)
     *
     * @return int Number of entries removed
     */
    public function cleanup(): int
    {
        try {
            $threshold = time() - self::ONLINE_THRESHOLD_SECONDS;

            // Remove users inactive for > 5 minutes from sorted set
            $removed = Redis::zremrangebyscore(self::ONLINE_KEY, 0, $threshold);

            if ($removed > 0) {
                Log::info('Redis cleanup completed', [
                    'removed_count' => $removed,
                    'threshold_timestamp' => $threshold
                ]);
            }

            return $removed;

        } catch (\Exception $e) {
            Log::error('Redis cleanup failed', [
                'error' => $e->getMessage()
            ]);

            return 0;
        }
    }

    /**
     * Get statistics about online users
     *
     * @return array
     */
    public function getStats(): array
    {
        try {
            $onlineCount = $this->getOnlineCount();
            $totalKeys = Redis::dbsize();
            $memoryUsage = Redis::info('memory');

            return [
                'online_count' => $onlineCount,
                'total_redis_keys' => $totalKeys,
                'memory_used_mb' => round($memoryUsage['used_memory'] / 1024 / 1024, 2),
                'threshold_seconds' => self::ONLINE_THRESHOLD_SECONDS,
                'max_batch_size' => self::MAX_BATCH_SIZE
            ];

        } catch (\Exception $e) {
            Log::error('Redis getStats failed', [
                'error' => $e->getMessage()
            ]);

            return [];
        }
    }

    /**
     * Clear all online status data (use with caution)
     *
     * @return bool
     */
    public function clearAll(): bool
    {
        try {
            $pattern = self::USER_ACTIVITY_PREFIX . '*';
            $keys = Redis::keys($pattern);

            if (!empty($keys)) {
                Redis::del(...$keys);
            }

            Redis::del(self::ONLINE_KEY);

            Log::warning('Redis cleared all online status data', [
                'keys_deleted' => count($keys) + 1
            ]);

            return true;

        } catch (\Exception $e) {
            Log::error('Redis clearAll failed', [
                'error' => $e->getMessage()
            ]);

            return false;
        }
    }

    /**
     * Check if Redis is available
     *
     * @return bool
     */
    public function isAvailable(): bool
    {
        try {
            Redis::ping();
            return true;
        } catch (\Exception $e) {
            return false;
        }
    }
}
