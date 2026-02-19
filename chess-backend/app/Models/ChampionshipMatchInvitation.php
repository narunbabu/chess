<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ChampionshipMatchInvitation extends Model
{
    use HasFactory;

    protected $fillable = [
        'match_id',
        'invited_player_id',
        'status',
        'expires_at',
        'responded_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'responded_at' => 'datetime',
    ];

    public function match()
    {
        return $this->belongsTo(ChampionshipMatch::class, 'match_id');
    }

    public function invitedPlayer()
    {
        return $this->belongsTo(User::class, 'invited_player_id');
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeExpired($query)
    {
        return $query->where('status', 'pending')
            ->where('expires_at', '<', now());
    }
}
