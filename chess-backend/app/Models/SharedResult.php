<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SharedResult extends Model
{
    use HasFactory;

    protected $fillable = [
        'unique_id',
        'game_id',
        'user_id',
        'image_path',
        'result_data',
        'view_count',
    ];

    protected $casts = [
        'result_data' => 'array',
        'view_count' => 'integer',
    ];

    /**
     * Get the user who shared this result
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the game associated with this shared result
     */
    public function game()
    {
        return $this->belongsTo(Game::class);
    }
}
