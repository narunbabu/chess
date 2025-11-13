<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Enums\ChampionshipMatchStatus as ChampionshipMatchStatusEnum;
use App\Enums\ChampionshipRoundType as ChampionshipRoundTypeEnum;
use App\Enums\ChampionshipResultType as ChampionshipResultTypeEnum;

class ChampionshipMatch extends Model
{
    use HasFactory;

    protected $fillable = [
        'championship_id',
        'round_number',
        'round_type',       // Virtual attribute (mutator converts to round_type_id)
        'round_type_id',    // FK to championship_round_types table
        'player1_id',
        'player2_id',
        'game_id',
        'scheduled_at',
        'deadline',
        'winner_id',
        'result_type',      // Virtual attribute (mutator converts to result_type_id)
        'result_type_id',   // FK to championship_result_types table
        'status',           // Virtual attribute (mutator converts to status_id)
        'status_id',        // FK to championship_match_statuses table
    ];

    protected $casts = [
        'championship_id' => 'integer',
        'round_number' => 'integer',
        'round_type_id' => 'integer',
        'player1_id' => 'integer',
        'player2_id' => 'integer',
        'game_id' => 'integer',
        'scheduled_at' => 'datetime',
        'deadline' => 'datetime',
        'winner_id' => 'integer',
        'result_type_id' => 'integer',
        'status_id' => 'integer',
    ];

    /**
     * Append accessor attributes to JSON serialization
     */
    protected $appends = [
        'status',
        'round_type',
        'result_type',
    ];

    // Relationships

    /**
     * The championship this match belongs to
     */
    public function championship()
    {
        return $this->belongsTo(Championship::class);
    }

    /**
     * Player 1 (white player)
     */
    public function player1()
    {
        return $this->belongsTo(User::class, 'player1_id');
    }

    /**
     * Player 2 (black player)
     */
    public function player2()
    {
        return $this->belongsTo(User::class, 'player2_id');
    }

    /**
     * The game associated with this match
     */
    public function game()
    {
        return $this->belongsTo(Game::class);
    }

    /**
     * The winner of the match
     */
    public function winner()
    {
        return $this->belongsTo(User::class, 'winner_id');
    }

    /**
     * Relationship to ChampionshipMatchStatus lookup table
     */
    public function statusRelation()
    {
        return $this->belongsTo(ChampionshipMatchStatus::class, 'status_id');
    }

    /**
     * Relationship to ChampionshipRoundType lookup table
     */
    public function roundTypeRelation()
    {
        return $this->belongsTo(ChampionshipRoundType::class, 'round_type_id');
    }

    /**
     * Relationship to ChampionshipResultType lookup table
     */
    public function resultTypeRelation()
    {
        return $this->belongsTo(ChampionshipResultType::class, 'result_type_id');
    }

    // Mutators & Accessors

    /**
     * Mutator: Convert status string/enum to status_id FK
     */
    public function setStatusAttribute($value)
    {
        if ($value instanceof ChampionshipMatchStatusEnum) {
            $code = $value->value;
        } else {
            $code = $value;
        }

        $this->attributes['status_id'] = ChampionshipMatchStatus::getIdByCode($code);
    }

    /**
     * Accessor: Read status code from relationship
     */
    public function getStatusAttribute(): string
    {
        if (isset($this->attributes['status_id'])) {
            return $this->statusRelation?->code ??
                   ChampionshipMatchStatus::find($this->attributes['status_id'])?->code ??
                   'pending';
        }

        return 'pending';
    }

    /**
     * Mutator: Convert round type string/enum to round_type_id FK
     */
    public function setRoundTypeAttribute($value)
    {
        if ($value instanceof ChampionshipRoundTypeEnum) {
            $code = $value->value;
        } else {
            $code = $value;
        }

        $this->attributes['round_type_id'] = ChampionshipRoundType::getIdByCode($code);
    }

    /**
     * Accessor: Read round type code from relationship
     */
    public function getRoundTypeAttribute(): string
    {
        if (isset($this->attributes['round_type_id'])) {
            return $this->roundTypeRelation?->code ??
                   ChampionshipRoundType::find($this->attributes['round_type_id'])?->code ??
                   'swiss';
        }

        return 'swiss';
    }

    /**
     * Mutator: Convert result type string/enum to result_type_id FK
     */
    public function setResultTypeAttribute($value)
    {
        if ($value === null) {
            $this->attributes['result_type_id'] = null;
            return;
        }

        if ($value instanceof ChampionshipResultTypeEnum) {
            $code = $value->value;
        } else {
            $code = $value;
        }

        $this->attributes['result_type_id'] = ChampionshipResultType::getIdByCode($code);
    }

    /**
     * Accessor: Read result type code from relationship
     */
    public function getResultTypeAttribute(): ?string
    {
        if (isset($this->attributes['result_type_id']) && $this->attributes['result_type_id'] !== null) {
            return $this->resultTypeRelation?->code ??
                   ChampionshipResultType::find($this->attributes['result_type_id'])?->code;
        }

        return null;
    }

    // Scopes

    /**
     * Scope: Pending matches
     */
    public function scopePending($query)
    {
        return $query->where('status_id', ChampionshipMatchStatusEnum::PENDING->getId());
    }

    /**
     * Scope: In progress matches
     */
    public function scopeInProgress($query)
    {
        return $query->where('status_id', ChampionshipMatchStatusEnum::IN_PROGRESS->getId());
    }

    /**
     * Scope: Completed matches
     */
    public function scopeCompleted($query)
    {
        return $query->where('status_id', ChampionshipMatchStatusEnum::COMPLETED->getId());
    }

    /**
     * Scope: Matches for a specific round
     */
    public function scopeForRound($query, ?int $roundNumber)
    {
        if ($roundNumber === null) {
            return $query;
        }
        return $query->where('round_number', $roundNumber);
    }

    /**
     * Scope: Expired matches
     */
    public function scopeExpired($query)
    {
        return $query->where('deadline', '<', now())
                    ->where('status_id', '!=', ChampionshipMatchStatusEnum::COMPLETED->getId());
    }

    // Helper Methods

    /**
     * Get status as enum
     */
    public function getStatusEnum(): ChampionshipMatchStatusEnum
    {
        return ChampionshipMatchStatusEnum::from($this->status);
    }

    /**
     * Get round type as enum
     */
    public function getRoundTypeEnum(): ChampionshipRoundTypeEnum
    {
        return ChampionshipRoundTypeEnum::from($this->round_type);
    }

    /**
     * Get result type as enum (nullable)
     */
    public function getResultTypeEnum(): ?ChampionshipResultTypeEnum
    {
        return $this->result_type ? ChampionshipResultTypeEnum::from($this->result_type) : null;
    }

    /**
     * Mark match as completed
     */
    public function markAsCompleted(int $winnerId, string $resultType): void
    {
        $this->update([
            'winner_id' => $winnerId,
            'result_type' => $resultType,
            'status' => ChampionshipMatchStatusEnum::COMPLETED->value,
        ]);
    }

    /**
     * Handle forfeit by player 1
     */
    public function forfeitPlayer1(): void
    {
        $this->markAsCompleted(
            $this->player2_id,
            ChampionshipResultTypeEnum::FORFEIT_PLAYER1->value
        );
    }

    /**
     * Handle forfeit by player 2
     */
    public function forfeitPlayer2(): void
    {
        $this->markAsCompleted(
            $this->player1_id,
            ChampionshipResultTypeEnum::FORFEIT_PLAYER2->value
        );
    }

    /**
     * Handle double forfeit
     */
    public function doubleForfeit(): void
    {
        $this->update([
            'winner_id' => null,
            'result_type' => ChampionshipResultTypeEnum::DOUBLE_FORFEIT->value,
            'status' => ChampionshipMatchStatusEnum::COMPLETED->value,
        ]);
    }

    /**
     * Check if match has expired
     */
    public function hasExpired(): bool
    {
        return now()->greaterThan($this->deadline) &&
               !$this->getStatusEnum()->isFinished();
    }

    /**
     * Check if player is involved in this match
     */
    public function hasPlayer(int $userId): bool
    {
        return $this->player1_id === $userId || $this->player2_id === $userId;
    }

    /**
     * Get opponent for a given player
     */
    public function getOpponent(int $userId): ?User
    {
        if ($this->player1_id === $userId) {
            return $this->player2;
        }
        if ($this->player2_id === $userId) {
            return $this->player1;
        }
        return null;
    }
}
