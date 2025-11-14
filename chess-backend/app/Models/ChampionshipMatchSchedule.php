<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ChampionshipMatchSchedule extends Model
{
    use HasFactory;

    protected $fillable = [
        'championship_match_id',
        'proposer_id',
        'proposed_time',
        'status',
        'responder_id',
        'response_time',
        'proposer_message',
        'responder_message',
        'alternative_time',
        'alternative_message',
    ];

    protected $casts = [
        'proposed_time' => 'datetime',
        'response_time' => 'datetime',
        'alternative_time' => 'datetime',
    ];

    /**
     * Get the championship match that this schedule belongs to
     */
    public function championshipMatch()
    {
        return $this->belongsTo(ChampionshipMatch::class);
    }

    /**
     * Get the user who proposed the schedule
     */
    public function proposer()
    {
        return $this->belongsTo(User::class, 'proposer_id');
    }

    /**
     * Get the user who responded to the proposal
     */
    public function responder()
    {
        return $this->belongsTo(User::class, 'responder_id');
    }

    /**
     * Check if the schedule is pending response
     */
    public function isPending(): bool
    {
        return $this->status === 'proposed';
    }

    /**
     * Check if the schedule has been accepted
     */
    public function isAccepted(): bool
    {
        return $this->status === 'accepted';
    }

    /**
     * Check if there's an alternative proposal
     */
    public function hasAlternative(): bool
    {
        return $this->status === 'alternative_proposed' && $this->alternative_time !== null;
    }

    /**
     * Get the current proposed time (original or alternative)
     */
    public function getCurrentProposedTime(): ?\Carbon\Carbon
    {
        return $this->hasAlternative() ? $this->alternative_time : $this->proposed_time;
    }
}
