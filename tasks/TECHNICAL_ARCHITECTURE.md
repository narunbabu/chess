# Chess Web - Technical Architecture Documentation

**Project:** Real-time Multiplayer Chess Platform
**Phase:** Post Phase 1 (Foundation Complete)
**Architecture Version:** 2.0

---

## 🏗️ System Architecture Overview

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Laravel API   │    │   Database      │
│   (Blade/JS)    │◄──►│   + Reverb WS   │◄──►│   MySQL + Redis │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                        │                        │
        │                        │                        │
        v                        v                        v
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Chess Engine  │    │   Game Logic    │    │   Session Mgmt  │
│   (Client-side) │    │   (Server-side) │    │   (Redis)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Technology Stack
- **Backend:** Laravel 11 + PHP 8.1+
- **WebSockets:** Laravel Reverb (native WebSocket server)
- **Database:** MySQL 8+ (primary), Redis 6+ (sessions/cache)
- **Frontend:** Blade templates + Vanilla JavaScript/Alpine.js
- **Chess Logic:** Custom PHP chess engine + JavaScript board
- **Real-time:** Pusher protocol via Laravel Reverb

---

## 🔌 WebSocket Communication Layer

### Connection Architecture
```
Client WebSocket ←→ Laravel Reverb ←→ Laravel App ←→ Game Logic
     │                    │               │            │
     │                    │               │            │
     v                    v               v            v
Authentication      Channel Mgmt    Event Dispatch  State Mgmt
```

### Channel Structure
```php
// Private game channels
private-game.{gameId}           // Game-specific events
private-game.{gameId}.player.{playerId}  // Player-specific events

// Presence channels
presence-lobby                  // General lobby presence
presence-game.{gameId}         // Game-specific presence

// Public channels
public-rooms                   // Room listing updates
```

### Message Protocol
```typescript
interface GameMessage {
    type: 'move' | 'handshake' | 'state_sync' | 'game_control'
    gameId: string
    playerId: string
    timestamp: number
    data: MessageData
    sequence?: number
}

interface MoveMessage extends GameMessage {
    type: 'move'
    data: {
        from: string      // e.g., 'e2'
        to: string        // e.g., 'e4'
        promotion?: string // e.g., 'Q'
        notation: string  // e.g., 'e4'
        fen: string      // Full board state
    }
}
```

---

## 🎯 Game State Management

### Authoritative Server Model
```
Client Move Request → Server Validation → State Update → Broadcast
     │                       │               │            │
     │                       │               │            │
     v                       v               v            v
Input Capture         Chess Rules       Database       All Clients
```

### State Synchronization Strategy
- **Single Source of Truth:** Server maintains authoritative game state
- **Optimistic Updates:** Client shows move immediately, rolls back if invalid
- **Conflict Resolution:** Server timestamp determines move order
- **State Recovery:** Full state sync on reconnection

### Database Schema Integration
```sql
-- Core game state
games: id, white_player_id, black_player_id, current_fen, game_status, created_at

-- Move history
game_moves: id, game_id, player_id, move_notation, from_square, to_square, timestamp

-- Real-time state
user_presence: user_id, channel, status, last_seen
```

---

## 🔐 Authentication & Security

### WebSocket Authentication
```php
// Reverb authentication middleware
class GameChannelAuth
{
    public function join($user, $channel, $payload)
    {
        // Verify user can join specific game channel
        return $this->canJoinGame($user, $payload['game_id']);
    }
}
```

### Security Measures
- **Channel Authorization:** Players can only join games they're part of
- **Move Validation:** Server validates all moves against chess rules
- **Rate Limiting:** Prevent spam moves and DoS attacks
- **Input Sanitization:** All client input validated and sanitized
- **Session Security:** Secure WebSocket token authentication

---

## ⚡ Performance Optimization

### Caching Strategy
```php
// Redis caching layers
game_state:{gameId}     // Current game state (TTL: 4 hours)
user_session:{userId}   // User session data (TTL: 24 hours)
active_games           // List of active games (TTL: 1 hour)
room_list              // Public room listing (TTL: 30s)
```

### Database Optimization
- **Indexing:** game_id, player_id, timestamp columns
- **Connection Pooling:** Reuse database connections
- **Query Optimization:** Eager loading, selective queries
- **Write Batching:** Batch move history writes

### WebSocket Optimization
- **Message Batching:** Group related messages
- **Compression:** Enable WebSocket message compression
- **Connection Reuse:** Maintain persistent connections
- **Heartbeat:** Regular ping/pong for connection health

---

## 🎮 Chess Engine Architecture

### Client-Side Engine (JavaScript)
```javascript
class ChessBoard {
    constructor() {
        this.position = new FEN(); // Board state
        this.legalMoves = new MoveGenerator();
        this.validator = new MoveValidator();
    }

    makeMove(from, to) {
        // Optimistic update
        // Send to server for validation
        // Rollback if rejected
    }
}
```

### Server-Side Engine (PHP)
```php
class ChessEngine
{
    public function validateMove($gameState, $move): bool
    {
        // Parse current FEN position
        // Generate legal moves
        // Validate move against rules
        // Return validation result
    }

    public function applyMove($gameState, $move): GameState
    {
        // Apply move to board state
        // Update FEN notation
        // Check for special conditions
        // Return new state
    }
}
```

### Move Validation Pipeline
```
Client Move → Format Check → Legal Move Check → Game State Check → Apply Move
     │             │              │                 │               │
     │             │              │                 │               │
     v             v              v                 v               v
Input Valid?  Chess Rules?   Turn Order?      State Update    Broadcast
```

---

## 🔄 Real-time Event Flow

### Game Connection Flow
```
1. Player joins game room URL
2. Authenticate WebSocket connection
3. Subscribe to game channels
4. Receive current game state
5. Send handshake/ready signal
6. Begin real-time gameplay
```

### Move Processing Flow
```
1. Player makes move on board
2. Client validates move locally
3. Send move to server via WebSocket
4. Server validates move
5. Update database with move
6. Broadcast move to opponent
7. Update game state for all clients
```

### Reconnection Flow
```
1. Detect connection loss
2. Attempt automatic reconnection
3. Re-authenticate if needed
4. Request current game state
5. Sync local state with server
6. Resume normal operation
```

---

## 📊 Monitoring & Observability

### Key Metrics
- **Connection Metrics:** Active connections, connection success rate
- **Game Metrics:** Games started, completed, average duration
- **Performance Metrics:** Message latency, server response time
- **Error Metrics:** Failed moves, disconnections, validation errors

### Logging Strategy
```php
// Structured logging for game events
Log::info('game.move.made', [
    'game_id' => $gameId,
    'player_id' => $playerId,
    'move' => $move,
    'timestamp' => now(),
    'latency_ms' => $latency
]);
```

### Health Checks
- **WebSocket Health:** Connection status and message flow
- **Database Health:** Query performance and connection pool
- **Redis Health:** Cache hit rates and memory usage
- **Application Health:** Error rates and response times

---

## 🚀 Scalability Considerations

### Horizontal Scaling
```
Load Balancer → Multiple Laravel Instances → Shared Redis → Shared Database
     │               │                         │             │
     │               │                         │             │
     v               v                         v             v
WebSocket      Application Logic         Session Store   Game Data
Distribution   (Stateless)              (Centralized)   (Centralized)
```

### Performance Targets
- **Concurrent Games:** 100+ simultaneous games
- **Message Latency:** <100ms average
- **Connection Time:** <3s to join game
- **Uptime:** 99.9% availability
- **Database Response:** <50ms average query time

### Resource Planning
- **Memory:** 512MB per 50 concurrent games
- **CPU:** 2 cores per 100 concurrent users
- **Network:** 1MB/s per 100 active connections
- **Storage:** 1GB per 10,000 completed games

---

## 🔧 Development Workflow

### Local Development Setup
```bash
# 1. Start Redis
redis-server

# 2. Start database
mysql.server start

# 3. Start Reverb WebSocket server
php artisan reverb:start

# 4. Start Laravel development server
php artisan serve

# 5. Optional: Start queue worker
php artisan queue:work
```

### Testing Strategy
```php
// Feature tests for game flow
class GameFlowTest extends TestCase
{
    public function test_complete_game_flow()
    {
        // Create game and players
        // Test connection handshake
        // Test move synchronization
        // Test game completion
    }
}

// WebSocket integration tests
class WebSocketTest extends TestCase
{
    public function test_move_broadcasting()
    {
        // Test real-time move transmission
        // Verify state synchronization
        // Test error handling
    }
}
```

### Deployment Pipeline
```yaml
# CI/CD Pipeline
stages:
  - test:
      - php_unit_tests
      - javascript_tests
      - integration_tests

  - build:
      - optimize_autoloader
      - build_assets
      - create_deployment_package

  - deploy:
      - deploy_to_staging
      - run_smoke_tests
      - deploy_to_production
```

---

**Last Updated:** September 27, 2025
**Next Review:** Phase 2A implementation start
**Architecture Version:** 2.0 (Post Phase 1)