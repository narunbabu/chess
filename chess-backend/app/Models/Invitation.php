<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Invitation extends Model
{
    use HasFactory;

    protected $fillable = [
        'inviter_id',
        'invited_id',
        'status',
        'game_id',
        'inviter_preferred_color',
        'responded_by',
        'responded_at'
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function inviter()
    {
        return $this->belongsTo(User::class, 'inviter_id');
    }

    public function invited()
    {
        return $this->belongsTo(User::class, 'invited_id');
    }

    public function game()
    {
        return $this->belongsTo(Game::class, 'game_id');
    }

    /**
     * Scope to get only accepted invitations with active games
     */
    public function scopeAcceptedActive($query)
    {
        return $query->where('status', 'accepted')
            ->whereHas('game', function ($q) {
                $q->whereNotIn('status', ['finished', 'completed', 'aborted']);
            });
    }
}