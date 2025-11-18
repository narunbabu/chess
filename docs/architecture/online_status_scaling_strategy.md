# Online Status Scaling Strategy
**For 1,000+ to 100,000+ Concurrent Users**

## Current System Analysis

### Current Performance Profile (< 1,000 users)
- **Database**: Direct queries to `users` table with `last_activity_at`
- **Caching**: 30-second application cache
- **Batch Size**: No limit on batch checks
- **Scope**: Global - checks all users
- **Query Cost**: O(n) where n = number of users to check

### Bottlenecks at Scale

#### 1. Database Load
**Problem**: Thousands of status checks hit database constantly
```sql
-- This query runs hundreds of times per second at scale
SELECT id, name, last_activity_at
FROM users
WHERE id IN (1,2,3,...1000)  -- Large IN clause
AND last_activity_at >= NOW() - INTERVAL 5 MINUTE
```

**Impact**:
- Database CPU spikes
- Slow query times (>100ms)
- Connection pool exhaustion

#### 2. Network Overhead
**Problem**: Transferring thousands of status objects
```json
{
  "statuses": [
    {"user_id": 1, "is_online": true, ...},  // × 1000
    {"user_id": 2, "is_online": false, ...},
    // ... 1000 more objects
  ]
}
```

**Impact**:
- Large response payloads (100KB+)
- Slow API responses
- High bandwidth costs

#### 3. Memory Consumption
**Problem**: Frontend caching thousands of statuses
```javascript
playerStatuses = {
  1: true, 2: false, 3: true, ... // × 10,000
}
```

**Impact**:
- High browser memory usage
- Cache invalidation complexity
- State management overhead

## Scaling Solutions

### 🎯 Solution 1: Redis Caching Layer (Immediate - Handles 10,000+ users)

**Why Redis?**
- In-memory: 100x faster than database
- Built-in TTL: Automatic expiration
- Sorted Sets: Efficient range queries
- Pub/Sub: Real-time updates

#### Implementation

**Backend - Redis Status Store**:
```php
// app/Services/RedisStatusService.php
class RedisStatusService
{
    private const ONLINE_KEY = 'users:online';
    private const USER_ACTIVITY_PREFIX = 'user:activity:';
    private const ONLINE_THRESHOLD_SECONDS = 300; // 5 minutes

    /**
     * Mark user as online
     */
    public function markOnline(int $userId): void
    {
        $timestamp = time();

        // Add to sorted set with current timestamp as score
        Redis::zadd(self::ONLINE_KEY, $timestamp, $userId);

        // Set user activity with TTL
        Redis::setex(
            self::USER_ACTIVITY_PREFIX . $userId,
            self::ONLINE_THRESHOLD_SECONDS,
            $timestamp
        );
    }

    /**
     * Check if user is online
     */
    public function isOnline(int $userId): bool
    {
        $key = self::USER_ACTIVITY_PREFIX . $userId;
        return Redis::exists($key) > 0;
    }

    /**
     * Batch check users - O(n) but in-memory
     */
    public function batchCheck(array $userIds): array
    {
        $pipeline = Redis::pipeline();

        foreach ($userIds as $userId) {
            $pipeline->exists(self::USER_ACTIVITY_PREFIX . $userId);
        }

        $results = $pipeline->execute();

        return array_combine($userIds, array_map(fn($r) => $r > 0, $results));
    }

    /**
     * Get all online users - Efficient with sorted set
     */
    public function getOnlineUsers(int $limit = 1000): array
    {
        $threshold = time() - self::ONLINE_THRESHOLD_SECONDS;

        // Get users active since threshold
        return Redis::zrangebyscore(
            self::ONLINE_KEY,
            $threshold,
            '+inf',
            ['limit' => [0, $limit]]
        );
    }

    /**
     * Get online count - O(log n)
     */
    public function getOnlineCount(): int
    {
        $threshold = time() - self::ONLINE_THRESHOLD_SECONDS;
        return Redis::zcount(self::ONLINE_KEY, $threshold, '+inf');
    }

    /**
     * Clean up old entries (run periodically)
     */
    public function cleanup(): void
    {
        $threshold = time() - self::ONLINE_THRESHOLD_SECONDS;

        // Remove users inactive for > 5 minutes
        Redis::zremrangebyscore(self::ONLINE_KEY, 0, $threshold);
    }
}
```

**Performance Improvement**:
- Database queries: **10,000/sec → 100/sec** (99% reduction)
- Response time: **200ms → 5ms** (40x faster)
- Memory efficient: Redis uses optimized data structures
- Auto-cleanup: TTL handles expiration

---

### 🎯 Solution 2: Scoped Presence (Context-Aware)

**Concept**: Only track status for users **relevant to current context**

#### Championship-Scoped Tracking

**Problem**: User viewing Championship A doesn't need status of users in Championship B

**Solution**: Presence channels per championship

```javascript
// Frontend - Championship-specific status tracking
class ChampionshipPresenceService {
  constructor(championshipId) {
    this.championshipId = championshipId;
    this.participantIds = [];
  }

  async initialize(championship) {
    // Only track participants of THIS championship
    this.participantIds = championship.participants.map(p => p.user_id);

    // Batch check only these users (5-100 users instead of 10,000)
    await this.updateParticipantStatuses();

    // Poll only these users every 30s
    this.startPolling();
  }

  async updateParticipantStatuses() {
    // Small batch: 5-100 users instead of thousands
    const statuses = await userStatusService.batchCheckStatus(
      this.participantIds
    );

    this.emit('statusUpdate', statuses);
  }
}
```

**Backend - Championship Presence API**:
```php
// GET /api/championships/{id}/participants/status
public function getParticipantStatuses(Championship $championship)
{
    // Only check participants (typically 5-100 users)
    $participantIds = $championship->participants()
        ->pluck('user_id')
        ->toArray();

    // Use Redis for fast lookup
    $statuses = $this->redisStatusService->batchCheck($participantIds);

    return response()->json([
        'championship_id' => $championship->id,
        'statuses' => $statuses,
        'online_count' => count(array_filter($statuses))
    ]);
}
```

**Benefits**:
- **99% reduction** in users tracked per page
- Championship with 20 participants: Check 20 instead of 10,000
- Scales linearly with championship size, not user base

---

### 🎯 Solution 3: Event-Driven Updates (Push vs Pull)

**Current**: Frontend polls every 30 seconds (wasteful)
**Better**: Server pushes changes when they occur

#### Server-Sent Events (SSE)

```php
// Backend - Status change stream
// GET /api/championships/{id}/status-stream
public function statusStream(Championship $championship)
{
    return response()->stream(function () use ($championship) {
        $participantIds = $championship->participants()
            ->pluck('user_id')
            ->toArray();

        $redis = Redis::connection();
        $pubsub = $redis->pubSubLoop();

        // Subscribe to status changes for participants
        $pubsub->subscribe(['status:' . implode(',', $participantIds)]);

        foreach ($pubsub as $message) {
            if ($message->kind === 'message') {
                echo "data: " . $message->payload . "\n\n";
                ob_flush();
                flush();
            }
        }
    }, 200, [
        'Content-Type' => 'text/event-stream',
        'Cache-Control' => 'no-cache',
        'X-Accel-Buffering' => 'no'
    ]);
}
```

```javascript
// Frontend - Event listener
const eventSource = new EventSource(
  `/api/championships/${championshipId}/status-stream`
);

eventSource.onmessage = (event) => {
  const { user_id, is_online } = JSON.parse(event.data);

  // Update only changed user
  setPlayerStatuses(prev => ({
    ...prev,
    [user_id]: is_online
  }));
};
```

**Benefits**:
- **Real-time updates** (< 1 second latency)
- **90% less network traffic** (only send changes)
- **Lower server load** (no polling)

---

### 🎯 Solution 4: Materialized View with Incremental Updates

**For Database-Heavy Queries at Scale**

```sql
-- Materialized view for online users
CREATE MATERIALIZED VIEW online_users_mv AS
SELECT
    id,
    name,
    last_activity_at,
    CASE
        WHEN last_activity_at >= NOW() - INTERVAL 5 MINUTE
        THEN true
        ELSE false
    END as is_online
FROM users
WHERE last_activity_at >= NOW() - INTERVAL 1 HOUR;

CREATE INDEX idx_online_users_mv_activity
ON online_users_mv(last_activity_at DESC);

CREATE INDEX idx_online_users_mv_status
ON online_users_mv(is_online);
```

```php
// Refresh strategy
// Option 1: Periodic refresh (every 30 seconds)
Schedule::command('refresh:online-users')
    ->everyThirtySeconds();

// Option 2: Incremental refresh (PostgreSQL)
REFRESH MATERIALIZED VIEW CONCURRENTLY online_users_mv;

// Query becomes super fast
DB::table('online_users_mv')
    ->where('is_online', true)
    ->whereIn('id', $userIds)
    ->get(); // < 5ms even with 100k users
```

**Benefits**:
- **Pre-computed results**: No calculation at query time
- **Fast lookups**: Indexed materialized view
- **Concurrent refresh**: No downtime during updates

---

### 🎯 Solution 5: Smart Pagination & Lazy Loading

**Don't load all 10,000 statuses at once**

```javascript
// Frontend - Lazy status loading
const MatchList = ({ matches }) => {
  const [visibleMatches, setVisibleMatches] = useState([]);
  const observer = useRef();

  // Intersection Observer for lazy loading
  const lastMatchRef = useCallback(node => {
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        loadMoreMatches(); // Load next batch
      }
    });

    if (node) observer.current.observe(node);
  }, []);

  // Only check statuses for visible matches
  useEffect(() => {
    const visiblePlayerIds = visibleMatches
      .flatMap(m => [m.player1_id, m.player2_id])
      .filter(Boolean);

    batchCheckStatus(visiblePlayerIds); // Check 20-50 users, not 10,000
  }, [visibleMatches]);

  return (
    <>
      {visibleMatches.map((match, index) => (
        <MatchCard
          key={match.id}
          match={match}
          ref={index === visibleMatches.length - 1 ? lastMatchRef : null}
        />
      ))}
    </>
  );
};
```

**Benefits**:
- Only check statuses for **visible users**
- Load more as user scrolls
- **10-20 checks instead of 10,000**

---

### 🎯 Solution 6: Status Compression & Delta Updates

**Reduce payload size for large batches**

```javascript
// Instead of full objects:
{
  "statuses": [
    {"user_id": 1, "is_online": true, "name": "...", "last_seen": "..."},
    // × 1000
  ]
}

// Send compact format:
{
  "online": [1, 5, 7, 12, ...],  // Just IDs of online users
  "total_checked": 1000,
  "timestamp": 1705497600
}

// Frontend reconstruction:
const statuses = {};
allUserIds.forEach(id => {
  statuses[id] = onlineIds.includes(id);
});
```

**Payload reduction**:
- Before: ~100 KB for 1000 users
- After: ~5 KB for 1000 users
- **95% smaller payloads**

---

## Complete Scaling Architecture

### Recommended Stack (10,000 - 100,000 users)

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend Layer                        │
│  - Scoped tracking (championship/game context)          │
│  - Lazy loading (visible users only)                    │
│  - Event-driven updates (SSE/WebSocket)                 │
│  - Compressed payloads                                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   API Layer (Laravel)                    │
│  - Rate limiting per user/endpoint                      │
│  - Request coalescing (debounce similar requests)       │
│  - Response compression (gzip)                          │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌──────────────────┐    ┌──────────────────┐
│  Redis Cache     │    │  Database        │
│  (Primary)       │    │  (Fallback)      │
│                  │    │                  │
│  - Sorted sets   │    │  - last_activity │
│  - TTL keys      │    │  - Indexed       │
│  - Pub/Sub       │    │  - Materialized  │
│  - O(log n)      │    │    views         │
│                  │    │                  │
│  Hit rate: 99%   │◄───│  Hit rate: 1%    │
└──────────────────┘    └──────────────────┘
```

### Request Flow

```
1. User opens Championship page
   └─> Load championship (DB)
   └─> Get participant IDs (5-100 users)

2. Check participant statuses
   └─> Try Redis cache (5ms)
       ├─> Cache hit (99%): Return immediately
       └─> Cache miss (1%): Query DB + update cache

3. Subscribe to status changes
   └─> SSE connection for this championship
   └─> Receive real-time updates (push)

4. Periodic refresh (fallback)
   └─> Every 60s, refresh visible users
   └─> Debounced: Only if SSE disconnected
```

---

## Implementation Priority

### Phase 1: Immediate (Handles 1,000 - 10,000 users)
1. ✅ **Scoped Tracking** - Championship-specific status checks
2. ✅ **Lazy Loading** - Check only visible matches
3. ⚠️ **Batch Size Limits** - Max 100 users per batch
4. ⚠️ **Rate Limiting** - 10 requests/minute per user

**Effort**: 4 hours
**Impact**: 10x capacity increase

### Phase 2: High Impact (Handles 10,000 - 50,000 users)
1. 🔲 **Redis Caching Layer** - Primary status store
2. 🔲 **Status Compression** - Compact response format
3. 🔲 **Connection Pooling** - Database optimization
4. 🔲 **Response Caching** - CDN for static data

**Effort**: 2 days
**Impact**: 50x capacity increase

### Phase 3: Real-time (Handles 50,000 - 100,000+ users)
1. 🔲 **Server-Sent Events** - Push updates
2. 🔲 **Presence Channels** - WebSocket rooms per championship
3. 🔲 **Materialized Views** - Pre-computed queries
4. 🔲 **Read Replicas** - Database horizontal scaling

**Effort**: 1 week
**Impact**: 100x+ capacity increase

---

## Performance Benchmarks

### Current System (< 1,000 users)
| Metric | Value |
|--------|-------|
| Status check latency | 50-200ms |
| Batch check (100 users) | 150-300ms |
| Max concurrent checks | ~1,000/sec |
| Database load | Medium |
| Memory usage | 10MB frontend |

### With Redis (1,000 - 10,000 users)
| Metric | Value |
|--------|-------|
| Status check latency | 2-10ms |
| Batch check (100 users) | 5-20ms |
| Max concurrent checks | ~50,000/sec |
| Database load | Very Low |
| Memory usage | 50MB Redis, 5MB frontend |

### With Full Stack (10,000 - 100,000+ users)
| Metric | Value |
|--------|-------|
| Status check latency | 1-5ms |
| Batch check (1000 users) | 10-30ms |
| Max concurrent checks | ~500,000/sec |
| Database load | Minimal |
| Memory usage | 200MB Redis, 10MB frontend |

---

## Cost Analysis

### Current System Costs (1,000 users)
- Database: Standard instance ($50/month)
- Bandwidth: ~100GB/month ($10/month)
- **Total**: ~$60/month

### Redis-Optimized (10,000 users)
- Database: Same ($50/month)
- Redis: Cache.r5.large ($100/month)
- Bandwidth: ~50GB/month ($5/month) - Reduced due to caching
- **Total**: ~$155/month
- **Cost per user**: $0.016/month (vs $0.060/month)

### Full Stack (100,000 users)
- Database: Read replicas ($200/month)
- Redis: Cluster ($300/month)
- Load balancer ($50/month)
- Bandwidth: ~200GB/month ($20/month)
- **Total**: ~$570/month
- **Cost per user**: $0.006/month

**ROI**: Better scaling efficiency = Lower cost per user

---

## Monitoring & Alerts

### Key Metrics to Track

```javascript
// Datadog / Prometheus metrics
{
  "online_status": {
    "redis_hit_rate": 0.99,           // Should be > 95%
    "avg_response_time_ms": 5,        // Should be < 50ms
    "p95_response_time_ms": 15,       // Should be < 100ms
    "batch_check_size_avg": 25,       // Should be < 100
    "concurrent_connections": 1250,   // Monitor for capacity
    "cache_memory_mb": 120,          // Monitor for limits
    "db_query_count_per_min": 150    // Should be low
  }
}
```

### Alert Thresholds

- ⚠️ **Warning**: Response time > 50ms
- 🚨 **Critical**: Response time > 200ms
- 🚨 **Critical**: Redis hit rate < 90%
- ⚠️ **Warning**: Batch size avg > 75
- 🚨 **Critical**: Database queries > 1,000/min

---

## Summary

### Quick Wins (Implement Now)
1. **Scoped tracking** - Check only relevant users
2. **Lazy loading** - Load visible matches only
3. **Batch limits** - Max 100 users per request
4. **Compression** - Send compact format

**Impact**: 10x capacity with minimal code changes

### Medium Term (Next Sprint)
1. **Redis caching** - 100x faster lookups
2. **Event-driven** - Push instead of pull
3. **Response compression** - 95% smaller payloads

**Impact**: 50-100x capacity, real-time updates

### Long Term (Production Ready)
1. **Materialized views** - Pre-computed queries
2. **Read replicas** - Horizontal database scaling
3. **CDN caching** - Global distribution

**Impact**: Unlimited scaling capacity

The key insight: **Don't track everyone, track only what matters right now.**
