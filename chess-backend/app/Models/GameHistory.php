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
        'result',
    ];

    // You might add a relationship to the User model
    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
