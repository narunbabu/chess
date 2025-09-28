<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GameConnection extends Model
{
    protected $fillable = [
        'user_id',
        'game_id',
        'connection_id',
        'socket_id',
        'status',
        'connected_at',
        'disconnected_at',
        'last_activity',
        'metadata'
    ];

    protected $casts = [
        'connected_at' => 'datetime',
        'disconnected_at' => 'datetime',
        'last_activity' => 'datetime',
        'metadata' => 'json'
    ];

    /**
     * Get the user that owns the connection.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the game for this connection.
     */
    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    /**
     * Create a new connection record
     */
    public static function createConnection(int $userId, int $gameId, string $socketId, array $metadata = []): self
    {
        return self::create([
            'user_id' => $userId,
            'game_id' => $gameId,
            'connection_id' => uniqid('conn_', true),
            'socket_id' => $socketId,
            'status' => 'connected',
            'connected_at' => now(),
            'last_activity' => now(),
            'metadata' => $metadata
        ]);
    }

    /**
     * Mark connection as disconnected
     */
    public function markDisconnected(): void
    {
        $this->update([
            'status' => 'disconnected',
            'disconnected_at' => now()
        ]);
    }

    /**
     * Update last activity timestamp
     */
    public function updateActivity(): void
    {
        $this->update([
            'last_activity' => now()
        ]);
    }

    /**
     * Get active connections for a game
     */
    public static function getActiveConnectionsForGame(int $gameId): \Illuminate\Database\Eloquent\Collection
    {
        return self::where('game_id', $gameId)
            ->where('status', 'connected')
            ->where('last_activity', '>', now()->subMinutes(5))
            ->with('user')
            ->get();
    }

    /**
     * Clean up stale connections
     */
    public static function cleanupStaleConnections(): int
    {
        return self::where('status', 'connected')
            ->where('last_activity', '<', now()->subMinutes(10))
            ->update([
                'status' => 'stale',
                'disconnected_at' => now()
            ]);
    }
}
