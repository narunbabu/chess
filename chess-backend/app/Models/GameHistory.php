<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GameHistory extends Model
{
    protected $fillable = [
        'user_id',
        'played_at',
        'player_color',
        'computer_level',
        'moves',
        'final_score',
        'opponent_score',
        'result',
        'game_id',
        'opponent_name',
        'opponent_avatar_url',
        'opponent_rating',
        'game_mode',
    ];

    // You might add a relationship to the User model
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // Relationship to the Game model (for multiplayer games)
    public function game()
    {
        return $this->belongsTo(Game::class);
    }
}
