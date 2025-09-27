<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GameMove extends Model
{
    protected $fillable = [
        'game_id',
        'user_id',
        'move_number',
        'from_square',
        'to_square',
        'piece_moved',
        'piece_captured',
        'move_notation',
        'board_state',
        'is_check',
        'is_checkmate',
        'is_castling',
        'is_en_passant',
        'promotion_piece',
        'time_taken_ms',
        'move_timestamp'
    ];

    protected $casts = [
        'board_state' => 'array',
        'is_check' => 'boolean',
        'is_checkmate' => 'boolean',
        'is_castling' => 'boolean',
        'is_en_passant' => 'boolean',
        'move_timestamp' => 'datetime'
    ];

    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the last move for a game
     */
    public static function getLastMoveForGame(int $gameId): ?GameMove
    {
        return static::where('game_id', $gameId)
            ->orderBy('move_number', 'desc')
            ->first();
    }

    /**
     * Get all moves for a game in order
     */
    public static function getMovesForGame(int $gameId)
    {
        return static::where('game_id', $gameId)
            ->orderBy('move_number', 'asc')
            ->get();
    }

    /**
     * Check if this move results in checkmate
     */
    public function isGameEnding(): bool
    {
        return $this->is_checkmate;
    }
}
