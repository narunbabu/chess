<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ChampionshipGameResumeRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'championship_match_id',
        'game_id',
        'requester_id',
        'recipient_id',
        'status',
        'expires_at',
        'responded_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'responded_at' => 'datetime',
    ];

    // Relationships

    public function championshipMatch()
    {
        return $this->belongsTo(ChampionshipMatch::class);
    }

    public function game()
    {
        return $this->belongsTo(Game::class);
    }

    public function requester()
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function recipient()
    {
        return $this->belongsTo(User::class, 'recipient_id');
    }

    // Scopes

    public function scopePending($query)
    {
        return $query->where('status', 'pending')
                    ->where('expires_at', '>', now());
    }

    public function scopeExpired($query)
    {
        return $query->where('status', 'pending')
                    ->where('expires_at', '<=', now());
    }

    // Helper methods

    public function isPending(): bool
    {
        return $this->status === 'pending' && now()->lessThan($this->expires_at);
    }

    public function isExpired(): bool
    {
        return $this->status === 'pending' && now()->greaterThanOrEqualTo($this->expires_at);
    }

    public function accept(): void
    {
        $this->update([
            'status' => 'accepted',
            'responded_at' => now(),
        ]);

        // Resume the game by setting status to active (5)
        if ($this->game) {
            $this->game->update(['status_id' => 5]); // 5 = active
            \Illuminate\Support\Facades\Log::info('🎮 Game resumed on accept', [
                'game_id' => $this->game_id,
                'request_id' => $this->id,
                'status' => 'active'
            ]);
        }
    }

    public function decline(): void
    {
        $this->update([
            'status' => 'declined',
            'responded_at' => now(),
        ]);
    }

    public function markExpired(): void
    {
        if ($this->isPending() && $this->isExpired()) {
            $this->update(['status' => 'expired']);
        }
    }
}
