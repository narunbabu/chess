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
        'championship_match_id',
        'inviter_preferred_color',
        'desired_color',
        'responded_by',
        'responded_at',
        'type',
        'priority',
        'expires_at',
        'auto_generated',
        'metadata'
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'responded_at' => 'datetime',
        'expires_at' => 'datetime',
        'auto_generated' => 'boolean',
        'metadata' => 'array',
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

    public function championshipMatch()
    {
        return $this->belongsTo(ChampionshipMatch::class, 'championship_match_id');
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

    /**
     * Scope to get only resume requests
     */
    public function scopeResumeRequests($query)
    {
        return $query->where('type', 'resume_request');
    }

    /**
     * Scope to get only game invitations
     */
    public function scopeGameInvitations($query)
    {
        return $query->where('type', 'game_invitation');
    }

    /**
     * Scope to get only active (non-expired) resume requests
     */
    public function scopeActiveResumeRequests($query)
    {
        return $query->where('type', 'resume_request')
            ->where('status', 'pending')
            ->where(function ($q) {
                $q->whereNull('expires_at')
                  ->orWhere('expires_at', '>', now());
            });
    }
}