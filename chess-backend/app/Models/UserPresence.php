<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserPresence extends Model
{
    protected $table = 'user_presence';

    protected $fillable = [
        'user_id',
        'status',
        'socket_id',
        'device_info',
        'last_activity',
        'current_game_id',
        'game_status'
    ];

    protected $casts = [
        'device_info' => 'array',
        'last_activity' => 'datetime'
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function currentGame(): BelongsTo
    {
        return $this->belongsTo(Game::class, 'current_game_id');
    }

    /**
     * Check if user is considered online
     */
    public function isOnline(): bool
    {
        return $this->status === 'online' &&
               $this->last_activity &&
               $this->last_activity->gt(now()->subMinutes(5));
    }

    /**
     * Update user's last activity
     */
    public function updateActivity(): void
    {
        $this->update(['last_activity' => now()]);
    }

    /**
     * Set user as online
     */
    public function setOnline(string $socketId = null, array $deviceInfo = null): void
    {
        $this->update([
            'status' => 'online',
            'socket_id' => $socketId,
            'device_info' => $deviceInfo,
            'last_activity' => now()
        ]);
    }

    /**
     * Set user as offline
     */
    public function setOffline(): void
    {
        $this->update([
            'status' => 'offline',
            'socket_id' => null,
            'last_activity' => now()
        ]);
    }

    /**
     * Get all online users
     */
    public static function getOnlineUsers()
    {
        return static::where('status', 'online')
            ->where('last_activity', '>', now()->subMinutes(5))
            ->with('user')
            ->get();
    }
}
