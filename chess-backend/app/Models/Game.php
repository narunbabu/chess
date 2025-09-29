<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Game extends Model
{
    use HasFactory;

    protected $fillable = [
        'white_player_id',
        'black_player_id',
        'status',
        'result',
        'winner_player',
        'winner_user_id',
        'end_reason',
        'move_count',
        'pgn',
        'fen',
        'moves',
        'turn',
        'last_move_at',
        'ended_at',
        'parent_game_id'
    ];

    protected $casts = [
        'moves' => 'array',
        'last_move_at' => 'datetime',
        'ended_at' => 'datetime'
    ];

    public function whitePlayer()
    {
        return $this->belongsTo(User::class, 'white_player_id');
    }

    public function blackPlayer()
    {
        return $this->belongsTo(User::class, 'black_player_id');
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
}