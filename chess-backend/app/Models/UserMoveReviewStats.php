<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserMoveReviewStats extends Model
{
    protected $table = 'user_move_review_stats';

    protected $fillable = [
        'user_id',
        'games_analyzed',
        'analyzed_moves',
        'ranked_moves_count',
        'rank_sum',
        'top_1_count',
        'top_2_count',
        'top_3_count',
        'outside_top_5_count',
        'best_button_uses',
        'coins_earned',
        'review_enabled_games',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'games_analyzed' => 'integer',
        'analyzed_moves' => 'integer',
        'ranked_moves_count' => 'integer',
        'rank_sum' => 'integer',
        'top_1_count' => 'integer',
        'top_2_count' => 'integer',
        'top_3_count' => 'integer',
        'outside_top_5_count' => 'integer',
        'best_button_uses' => 'integer',
        'coins_earned' => 'integer',
        'review_enabled_games' => 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
