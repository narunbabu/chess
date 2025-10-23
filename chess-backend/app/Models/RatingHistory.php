<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RatingHistory extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'old_rating',
        'new_rating',
        'rating_change',
        'opponent_id',
        'opponent_rating',
        'computer_level',
        'result',
        'game_type',
        'k_factor',
        'expected_score',
        'actual_score',
        'game_id',
    ];

    protected $casts = [
        'old_rating' => 'integer',
        'new_rating' => 'integer',
        'rating_change' => 'integer',
        'opponent_rating' => 'integer',
        'k_factor' => 'integer',
        'expected_score' => 'float',
        'actual_score' => 'float',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the user that owns the rating history.
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the opponent (if applicable).
     */
    public function opponent()
    {
        return $this->belongsTo(User::class, 'opponent_id');
    }

    /**
     * Get the game associated with this rating change.
     */
    public function game()
    {
        return $this->belongsTo(Game::class);
    }
}
