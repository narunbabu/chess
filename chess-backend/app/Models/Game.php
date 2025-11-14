<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Enums\GameStatus as GameStatusEnum;
use App\Enums\EndReason as EndReasonEnum;

class Game extends Model
{
    use HasFactory;

    protected $fillable = [
        'white_player_id',
        'black_player_id',
        'white_player_score',
        'black_player_score',
        'status',        // Virtual attribute (mutator converts to status_id)
        'status_id',     // FK to game_statuses table
        'result',
        'winner_player',
        'winner_user_id',
        'end_reason',    // Virtual attribute (mutator converts to end_reason_id)
        'end_reason_id', // FK to game_end_reasons table
        'move_count',
        'pgn',
        'fen',
        'moves',
        'turn',
        'last_move_at',
        'ended_at',
        'paused_at',
        'paused_reason',
        'paused_by_user_id',
        'last_heartbeat_at',
        'parent_game_id',
        // Pause time tracking
        'white_time_paused_ms',
        'black_time_paused_ms',
        'turn_at_pause',
        'white_grace_time_ms',
        'black_grace_time_ms',
        // Resume request tracking
        'resume_requested_by',
        'resume_requested_at',
        'resume_request_expires_at',
        'resume_status'
    ];

    protected $casts = [
        'moves' => 'array',
        'last_move_at' => 'datetime',
        'ended_at' => 'datetime',
        'paused_at' => 'datetime',
        'last_heartbeat_at' => 'datetime',
        'resume_requested_at' => 'datetime',
        'resume_request_expires_at' => 'datetime',
        'status_id' => 'integer',
        'end_reason_id' => 'integer',
        'white_player_id' => 'integer',
        'black_player_id' => 'integer',
        'white_player_score' => 'decimal:2',
        'black_player_score' => 'decimal:2',
        'white_time_paused_ms' => 'integer',
        'black_time_paused_ms' => 'integer',
        'white_grace_time_ms' => 'integer',
        'black_grace_time_ms' => 'integer',
        'resume_requested_by' => 'integer'
    ];

    /**
     * Append accessor attributes to JSON serialization
     * Ensures status and end_reason are always included in API responses
     */
    protected $appends = [
        'status',
        'end_reason'
    ];

    public function whitePlayer()
    {
        return $this->belongsTo(User::class, 'white_player_id');
    }

    public function blackPlayer()
    {
        return $this->belongsTo(User::class, 'black_player_id');
    }

    public function pausedByUser()
    {
        return $this->belongsTo(User::class, 'paused_by_user_id');
    }

    /**
     * Get the championship match associated with this game (if any)
     */
    public function championshipMatch()
    {
        return $this->hasOne(ChampionshipMatch::class, 'game_id');
    }

    /**
     * Get championship context for this game
     */
    public function getChampionshipContext()
    {
        $championshipMatch = $this->championshipMatch()->with('championship')->first();

        if (!$championshipMatch) {
            return null;
        }

        return [
            'is_championship' => true,
            'championship_id' => $championshipMatch->championship_id,
            'championship' => $championshipMatch->championship,
            'match_id' => $championshipMatch->id,
            'round_number' => $championshipMatch->round_number,
            'board_number' => $championshipMatch->board_number,
        ];
    }

    public function getOpponent($userId)
    {
        if ($this->white_player_id == $userId) {
            return $this->blackPlayer;
        }
        return $this->whitePlayer;
    }

    public function hasOpponent($userId)
    {
        if ($this->white_player_id == $userId) {
            return $this->black_player_id !== null;
        }
        return $this->white_player_id !== null;
    }

    public function getPlayerColor($userId)
    {
        if ($this->white_player_id == $userId) {
            return 'white';
        }
        return 'black';
    }

    /**
     * Relationship to GameStatus lookup table
     */
    public function statusRelation()
    {
        return $this->belongsTo(GameStatus::class, 'status_id');
    }

    /**
     * Relationship to GameEndReason lookup table
     */
    public function endReasonRelation()
    {
        return $this->belongsTo(GameEndReason::class, 'end_reason_id');
    }

    /**
     * Mutator: Convert status string/enum to status_id FK
     * Supports legacy values for backward compatibility
     */
    public function setStatusAttribute($value)
    {
        // Handle enum or string input
        if ($value instanceof GameStatusEnum) {
            $code = $value->value;
        } else {
            // Map legacy values to canonical (backward compatibility)
            $enum = GameStatusEnum::fromLegacy($value);
            $code = $enum->value;
        }

        // Write to FK column only (old ENUM column no longer exists)
        $this->attributes['status_id'] = GameStatus::getIdByCode($code);
    }

    /**
     * Accessor: Read status code from relationship
     * This makes $game->status work transparently after column removal
     */
    public function getStatusAttribute(): string
    {
        // If status_id is set, load from relationship
        if (isset($this->attributes['status_id'])) {
            // Use eager-loaded relation if available, otherwise query
            return $this->statusRelation?->code ??
                   GameStatus::find($this->attributes['status_id'])?->code ??
                   'waiting'; // Fallback
        }

        return 'waiting'; // Default status
    }

    /**
     * Mutator: Convert end_reason string/enum to end_reason_id FK
     * Supports legacy values for backward compatibility
     */
    public function setEndReasonAttribute($value)
    {
        if ($value === null) {
            $this->attributes['end_reason_id'] = null;
            return;
        }

        // Handle enum or string input
        if ($value instanceof EndReasonEnum) {
            $code = $value->value;
        } else {
            // Map legacy values to canonical (backward compatibility)
            $enum = EndReasonEnum::fromLegacy($value);
            $code = $enum->value;
        }

        // Write to FK column only (old ENUM column no longer exists)
        $this->attributes['end_reason_id'] = GameEndReason::getIdByCode($code);
    }

    /**
     * Accessor: Read end_reason code from relationship
     * This makes $game->end_reason work transparently after column removal
     */
    public function getEndReasonAttribute(): ?string
    {
        // If end_reason_id is set, load from relationship
        if (isset($this->attributes['end_reason_id']) && $this->attributes['end_reason_id'] !== null) {
            // Use eager-loaded relation if available, otherwise query
            return $this->endReasonRelation?->code ??
                   GameEndReason::find($this->attributes['end_reason_id'])?->code;
        }

        return null; // No end reason
    }

    /**
     * Accessor: Get status code from relationship
     * Note: $game->status now uses getStatusAttribute() directly
     * This accessor is kept for explicit ->status_code access
     */
    public function getStatusCodeAttribute(): string
    {
        return $this->status; // Uses getStatusAttribute()
    }

    /**
     * Accessor: Get end reason code from relationship
     * Note: $game->end_reason now uses getEndReasonAttribute() directly
     * This accessor is kept for explicit ->end_reason_code access
     */
    public function getEndReasonCodeAttribute(): ?string
    {
        return $this->end_reason; // Uses getEndReasonAttribute()
    }

    /**
     * Check if game is in a terminal state (ended)
     */
    public function isFinished(): bool
    {
        return in_array($this->status, ['finished', 'aborted']);
    }

    /**
     * Get status as enum
     */
    public function getStatusEnum(): GameStatusEnum
    {
        return GameStatusEnum::from($this->status);
    }

    /**
     * Get end reason as enum (nullable)
     */
    public function getEndReasonEnum(): ?EndReasonEnum
    {
        return $this->end_reason ? EndReasonEnum::from($this->end_reason) : null;
    }

    /**
     * Get the last activity timestamp (max of last_move_at and last_heartbeat_at)
     */
    public function getLastActivityAt(): ?\Carbon\Carbon
    {
        $timestamps = array_filter([
            $this->last_move_at,
            $this->last_heartbeat_at,
            $this->updated_at
        ]);

        return !empty($timestamps) ? max($timestamps) : null;
    }

    /**
     * Get seconds since last activity
     */
    public function getInactiveSeconds(): int
    {
        $lastActivity = $this->getLastActivityAt();
        return $lastActivity ? now()->diffInSeconds($lastActivity) : 0;
    }

    /**
     * Check if game is paused
     */
    public function isPaused(): bool
    {
        return $this->status === 'paused';
    }

    /**
     * Get seconds since game was paused
     */
    public function getPausedSeconds(): int
    {
        return $this->paused_at ? now()->diffInSeconds($this->paused_at) : 0;
    }
}